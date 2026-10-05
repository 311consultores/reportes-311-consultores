"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { deleteObject } from "@/lib/storage";

type TargetType = "TASK" | "REPORT" | "CLIENT" | "PROJECT";

/** Ejecuta la eliminación real. Devuelve false si el elemento ya no existe. */
async function performDeletion(type: TargetType, targetId: string, userId: string): Promise<boolean> {
  if (type === "CLIENT") {
    const client = await prisma.client.findUnique({ where: { id: targetId } });
    if (!client) return false;
    await prisma.client.delete({ where: { id: client.id } }); // proyectos y accesos en cascada
    return true;
  }
  if (type === "PROJECT") {
    const project = await prisma.project.findUnique({ where: { id: targetId } });
    if (!project) return false;
    await prisma.project.delete({ where: { id: project.id } });
    return true;
  }
  if (type === "TASK") {
    const task = await prisma.reportTask.findUnique({ where: { id: targetId } });
    if (!task) return false;
    await prisma.$transaction(async (tx) => {
      await tx.reportTask.delete({ where: { id: task.id } });
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
        data: { reportId: task.reportId, userId, action: `DELETED_TASK_${task.sequentialNum}` },
      });
    });
    if (task.evidenceUrl) await deleteObject(task.evidenceUrl).catch(() => {});
    return true;
  }

  const report = await prisma.report.findUnique({ where: { id: targetId }, include: { tasks: true } });
  if (!report) return false;
  await prisma.report.delete({ where: { id: report.id } });
  await Promise.all(
    report.tasks.flatMap((t) => (t.evidenceUrl ? [deleteObject(t.evidenceUrl).catch(() => {})] : [])),
  );
  return true;
}

export async function requestDeletion(targetType: TargetType, targetId: string, reason?: string) {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const isAdmin = user.role === "ADMIN";

  if (targetType === "CLIENT" || targetType === "PROJECT") {
    if (!isAdmin) return { error: "Solo un administrador puede eliminar clientes o proyectos" };
    // Los reportes conservan su historial: no se puede borrar un cliente/proyecto que ya los tiene
    const reports = await prisma.report.count({
      where: targetType === "CLIENT" ? { clientId: targetId } : { projectId: targetId },
    });
    if (reports > 0) {
      return { error: `No se puede eliminar: tiene ${reports} reporte(s) asociado(s). Elimina los reportes primero.` };
    }
    if (!(await performDeletion(targetType, targetId, user.id))) return { error: "El elemento no existe" };
    await prisma.deletionRequest.create({
      data: {
        targetType,
        targetId,
        reason: reason?.trim() || null,
        requestedById: user.id,
        status: "APROBADO",
        reviewedById: user.id,
        resolvedAt: new Date(),
      },
    });
    revalidatePath("/clientes");
    return { executed: true as const };
  }

  const reportStatus =
    targetType === "TASK"
      ? (await prisma.reportTask.findUnique({ where: { id: targetId }, select: { report: { select: { status: true } } } }))
          ?.report.status
      : (await prisma.report.findUnique({ where: { id: targetId }, select: { status: true } }))?.status;
  if (!reportStatus) return { error: "El elemento no existe" };

  if (!isAdmin && (reportStatus === "ENVIADO" || reportStatus === "APROBADO")) {
    return { error: "Un reporte aprobado o enviado solo puede eliminarlo un administrador" };
  }

  const dup = await prisma.deletionRequest.findFirst({ where: { targetType, targetId, status: "PENDIENTE" } });
  if (dup) return { error: "Ya existe una solicitud pendiente" };

  const cleanReason = reason?.trim() || null;

  if (isAdmin) {
    await performDeletion(targetType, targetId, user.id);
    await prisma.deletionRequest.create({
      data: {
        targetType,
        targetId,
        reason: cleanReason,
        requestedById: user.id,
        status: "APROBADO",
        reviewedById: user.id,
        resolvedAt: new Date(),
      },
    });
    revalidatePath("/");
    return { executed: true as const };
  }

  await prisma.deletionRequest.create({
    data: { targetType, targetId, reason: cleanReason, requestedById: user.id },
  });
  revalidatePath("/eliminaciones");
  return { requested: true as const };
}

export async function resolveDeletion(requestId: string, approve: boolean): Promise<void> {
  const admin = await requireUser(["ADMIN"]);
  const req = await prisma.deletionRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDIENTE") return;

  if (approve) await performDeletion(req.targetType as TargetType, req.targetId, admin.id);
  await prisma.deletionRequest.update({
    where: { id: requestId },
    data: { status: approve ? "APROBADO" : "RECHAZADO", reviewedById: admin.id, resolvedAt: new Date() },
  });
  revalidatePath("/eliminaciones");
  revalidatePath("/");
}
