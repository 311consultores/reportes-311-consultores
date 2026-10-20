"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { deleteObject } from "@/lib/storage";
import { auditDetails } from "@/lib/consultants";

type TargetType = "TASK" | "REPORT" | "CLIENT" | "PROJECT" | "INVOICE" | "WORKTASK";

/** Texto legible del elemento, para el historial de eliminaciones (queda guardado aunque se borre). */
async function describeTarget(type: TargetType, id: string): Promise<string | null> {
  if (type === "CLIENT") {
    return (await prisma.client.findUnique({ where: { id }, select: { companyName: true } }))?.companyName ?? null;
  }
  if (type === "PROJECT") {
    const p = await prisma.project.findUnique({
      where: { id },
      select: { projectName: true, client: { select: { companyName: true } } },
    });
    return p ? `Proyecto ${p.projectName} (${p.client.companyName})` : null;
  }
  if (type === "INVOICE") {
    const i = await prisma.invoice.findUnique({
      where: { id },
      select: { kind: true, number: true, client: { select: { companyName: true } } },
    });
    return i ? `${i.kind === "FACTURA" ? "Factura" : "Recibo"}${i.number ? ` ${i.number}` : ""} de ${i.client.companyName}` : null;
  }
  if (type === "WORKTASK") {
    const t = await prisma.task.findUnique({ where: { id }, select: { title: true, client: { select: { companyName: true } } } });
    return t ? `Tarea «${t.title}» (${t.client.companyName})` : null;
  }
  if (type === "TASK") {
    const t = await prisma.reportTask.findUnique({
      where: { id },
      select: { sequentialNum: true, title: true, report: { select: { folio: true } } },
    });
    return t ? `Actividad ${t.sequentialNum}${t.title ? ` — ${t.title}` : ""} del reporte ${t.report.folio}` : null;
  }
  const r = await prisma.report.findUnique({
    where: { id },
    select: { folio: true, client: { select: { companyName: true } }, project: { select: { projectName: true } } },
  });
  return r ? `Reporte ${r.folio} (${r.client.companyName} · ${r.project.projectName})` : null;
}

/** Ejecuta la eliminación real. Devuelve false si el elemento ya no existe. */
async function performDeletion(type: TargetType, targetId: string, userId: string, reason: string): Promise<boolean> {
  if (type === "CLIENT") {
    const client = await prisma.client.findUnique({ where: { id: targetId } });
    if (!client) return false;
    await prisma.client.delete({ where: { id: client.id } }); // proyectos y accesos en cascada
    if (client.logoUrl) await deleteObject(client.logoUrl).catch(() => {});
    if (client.constanciaUrl) await deleteObject(client.constanciaUrl).catch(() => {}); // dato fiscal sensible
    return true;
  }
  if (type === "INVOICE") {
    const invoice = await prisma.invoice.findUnique({ where: { id: targetId } });
    if (!invoice) return false;
    if (invoice.status === "PAGADA") return false; // un cobro registrado no se borra: primero se revierte el pago
    if ((await prisma.ledgerEntry.count({ where: { invoiceId: invoice.id } })) > 0) return false; // conserva su historial contable
    await prisma.invoice.delete({ where: { id: invoice.id } }); // su historial se borra en cascada
    return true;
  }
  if (type === "PROJECT") {
    const project = await prisma.project.findUnique({ where: { id: targetId } });
    if (!project) return false;
    await prisma.project.delete({ where: { id: project.id } });
    return true;
  }
  if (type === "WORKTASK") {
    const t = await prisma.task.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!t) return false;
    await prisma.task.delete({ where: { id: t.id } }); // asignaciones, recursos e historial en cascada
    return true;
  }
  if (type === "TASK") {
    const task = await prisma.reportTask.findUnique({ where: { id: targetId }, include: { evidences: true } });
    if (!task) return false;
    await prisma.$transaction(async (tx) => {
      await tx.reportTask.delete({ where: { id: task.id } }); // las evidencias se borran en cascada
      const rest = await tx.reportTask.findMany({
        where: { reportId: task.reportId },
        orderBy: { sequentialNum: "asc" },
      });
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].sequentialNum !== i + 1) {
          await tx.reportTask.update({ where: { id: rest[i].id }, data: { sequentialNum: i + 1 } });
        }
      }
      await tx.auditLog.create({
        data: {
          reportId: task.reportId,
          userId,
          action: `DELETED_TASK_${task.sequentialNum}`,
          details: auditDetails({ reason, title: task.title }),
        },
      });
    });
    await Promise.all(task.evidences.map((e) => deleteObject(e.url).catch(() => {})));
    return true;
  }

  const report = await prisma.report.findUnique({
    where: { id: targetId },
    include: { tasks: { include: { evidences: true } } },
  });
  if (!report) return false;
  await prisma.report.delete({ where: { id: report.id } });
  await Promise.all(report.tasks.flatMap((t) => t.evidences.map((e) => deleteObject(e.url).catch(() => {}))));
  return true;
}

/** Elimina directamente (Admin) o crea una solicitud pendiente (Editor y PROJECT 311, este último solo para tareas). El motivo es obligatorio. */
export async function requestDeletion(targetType: TargetType, targetId: string, reason: string) {
  const user = await requireUser(["ADMIN", "EDITOR", "PROJECT_311"]);
  const isAdmin = user.role === "ADMIN";
  // El PROJECT 311 solo puede solicitar la eliminación de tareas del panel
  if (user.role === "PROJECT_311" && targetType !== "WORKTASK") return { error: "No tienes permiso para eliminar este elemento" };

  const cleanReason = reason?.trim() ?? "";
  if (cleanReason.length < 3) return { error: "Escribe el motivo de la eliminación" };

  const label = await describeTarget(targetType, targetId);
  if (!label) return { error: "El elemento no existe" };

  if (targetType === "CLIENT" || targetType === "PROJECT") {
    if (!isAdmin) return { error: "Solo un administrador puede eliminar clientes o proyectos" };
    // Los reportes conservan su historial: no se puede borrar un cliente/proyecto que ya los tiene
    const reports = await prisma.report.count({
      where: targetType === "CLIENT" ? { clientId: targetId } : { projectId: targetId },
    });
    if (reports > 0) {
      return { error: `No se puede eliminar: tiene ${reports} reporte(s) asociado(s). Elimina los reportes primero.` };
    }
    const tasks = await prisma.task.count({ where: targetType === "CLIENT" ? { clientId: targetId } : { projectId: targetId } });
    if (tasks > 0) {
      return { error: `No se puede eliminar: tiene ${tasks} tarea(s) en el panel de tareas. Elimina las tareas primero.` };
    }
    if (!(await performDeletion(targetType, targetId, user.id, cleanReason))) return { error: "El elemento no existe" };
    await prisma.deletionRequest.create({
      data: {
        targetType,
        targetId,
        targetLabel: label.slice(0, 191),
        reason: cleanReason,
        requestedById: user.id,
        status: "APROBADO",
        reviewedById: user.id,
        resolvedAt: new Date(),
      },
    });
    revalidatePath("/clientes");
    return { executed: true as const };
  }

  if (targetType === "INVOICE") {
    const invoice = await prisma.invoice.findUnique({ where: { id: targetId }, select: { status: true } });
    if (!invoice) return { error: "El elemento no existe" };
    if (invoice.status === "PAGADA") return { error: "Un documento pagado no se puede eliminar. El Administrador debe revertir el pago primero." };
    if ((await prisma.ledgerEntry.count({ where: { invoiceId: targetId } })) > 0) {
      return { error: "Este documento ya tuvo un cobro registrado en las cajas, por eso se conserva en el historial y no se puede eliminar." };
    }
  } else if (targetType === "WORKTASK") {
    // Las tareas del panel no dependen de ningún estado de reporte
  } else {
    const reportStatus =
      targetType === "TASK"
        ? (await prisma.reportTask.findUnique({ where: { id: targetId }, select: { report: { select: { status: true } } } }))
            ?.report.status
        : (await prisma.report.findUnique({ where: { id: targetId }, select: { status: true } }))?.status;
    if (!reportStatus) return { error: "El elemento no existe" };

    if (!isAdmin && (reportStatus === "ENVIADO" || reportStatus === "APROBADO")) {
      return { error: "Un reporte aprobado o enviado solo puede eliminarlo un administrador" };
    }
  }

  const dup = await prisma.deletionRequest.findFirst({ where: { targetType, targetId, status: "PENDIENTE" } });
  if (dup) return { error: "Ya existe una solicitud pendiente" };

  if (isAdmin) {
    await performDeletion(targetType, targetId, user.id, cleanReason);
    await prisma.deletionRequest.create({
      data: {
        targetType,
        targetId,
        targetLabel: label.slice(0, 191),
        reason: cleanReason,
        requestedById: user.id,
        status: "APROBADO",
        reviewedById: user.id,
        resolvedAt: new Date(),
      },
    });
    revalidatePath("/");
    revalidatePath("/facturas");
    revalidatePath("/eliminaciones");
    return { executed: true as const };
  }

  await prisma.deletionRequest.create({
    data: { targetType, targetId, targetLabel: label.slice(0, 191), reason: cleanReason, requestedById: user.id },
  });
  revalidatePath("/eliminaciones");
  return { requested: true as const };
}

export async function resolveDeletion(requestId: string, approve: boolean): Promise<void> {
  const admin = await requireUser(["ADMIN"]);
  const req = await prisma.deletionRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDIENTE") return;

  if (approve) {
    await performDeletion(req.targetType as TargetType, req.targetId, admin.id, req.reason ?? "Solicitud aprobada");
  }
  await prisma.deletionRequest.update({
    where: { id: requestId },
    data: { status: approve ? "APROBADO" : "RECHAZADO", reviewedById: admin.id, resolvedAt: new Date() },
  });
  revalidatePath("/eliminaciones");
  revalidatePath("/");
  revalidatePath("/facturas");
}
