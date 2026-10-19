"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type ReportStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasProjectAccess, requireUser } from "@/lib/auth";
import { nextFolio } from "@/lib/folio";
import { getReportPdf } from "@/lib/pdf-queue";
import { sendMail } from "@/lib/mailer";
import { serializeConsultants, auditDetails } from "@/lib/consultants";
import { reportEmail, reporteTerminadoEmail } from "@/lib/email-templates";
import { deleteTaskAndRenumber } from "@/lib/tasks";
import { readLogo311 } from "@/lib/branding";
import { nextFrase } from "@/lib/frases";
import { getBaseUrl } from "@/lib/base-url";

type State = { error?: string } | undefined;

const EDITABLE: ReportStatus[] = ["EN_PROCESO", "RECHAZADO"];

const toDate = (s: string) => new Date(`${s}T12:00:00`);

export async function createReport(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const parsed = z
    .object({
      clientId: z.string().uuid("Selecciona un cliente"),
      projectId: z.string().uuid("Selecciona un proyecto"),
      startDate: z.string().min(1, "Fecha inicial requerida"),
      endDate: z.string().min(1, "Fecha final requerida"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.endDate < d.startDate) return { error: "La fecha final no puede ser anterior a la inicial" };
  const project = await prisma.project.findFirst({ where: { id: d.projectId, clientId: d.clientId } });
  if (!project) return { error: "El proyecto no pertenece al cliente" };
  if (!hasProjectAccess(user, project.id)) return { error: "No tienes asignado ese proyecto" };

  // Consultores: usuarios TEAM 311 elegidos en la lista (se guardan sus nombres y sus ids)
  const wanted = [...new Set(fd.getAll("consultantIds").map(String).filter((s) => /^[0-9a-f-]{36}$/i.test(s)))];
  const team = await prisma.user.findMany({ where: { id: { in: wanted }, role: "TEAM_311", active: true }, select: { id: true, name: true } });
  if (team.length === 0) return { error: "Indica al menos un consultor" };
  const ordered = wanted.map((id) => team.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
  const consultants = ordered.map((t) => t.name);
  const consultantIds = JSON.stringify(ordered.map((t) => t.id));

  let id: string | null = null;
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    try {
      id = await prisma.$transaction(async (tx) => {
        const folio = await nextFolio(tx, d.clientId);
        const report = await tx.report.create({
          data: {
            folio,
            clientId: d.clientId,
            projectId: d.projectId,
            startDate: toDate(d.startDate),
            endDate: toDate(d.endDate),
            consultants: serializeConsultants(consultants),
            consultantIds,
            createdById: user.id,
          },
        });
        await tx.auditLog.create({
          data: { reportId: report.id, userId: user.id, action: "CREATED_REPORT", details: auditDetails({ folio }) },
        });
        return report.id;
      });
    } catch (e) {
      // Colisión de folio por concurrencia: reintentar
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  if (!id) return { error: "No se pudo generar el folio, intenta de nuevo" };
  redirect(`/reportes/${id}`);
}

async function editableReport(reportId: string) {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report || !hasProjectAccess(user, report.projectId)) throw new Error("Reporte no encontrado");
  if (!EDITABLE.includes(report.status)) throw new Error("El reporte ya no es editable");
  return { user, report };
}

export async function addTask(reportId: string) {
  const { user } = await editableReport(reportId);
  const task = await prisma.$transaction(async (tx) => {
    const last = await tx.reportTask.aggregate({ where: { reportId }, _max: { sequentialNum: true } });
    const t = await tx.reportTask.create({
      data: {
        reportId,
        sequentialNum: (last._max.sequentialNum ?? 0) + 1,
        descriptionHtml: "",
        createdById: user.id,
      },
    });
    await tx.auditLog.create({
      data: { reportId, userId: user.id, action: `ADDED_TASK_${t.sequentialNum}` },
    });
    return t;
  });
  return {
    id: task.id,
    sequentialNum: task.sequentialNum,
    title: null as string | null,
    executedAt: null as string | null,
    descriptionHtml: task.descriptionHtml,
    evidences: [] as { id: string; url: string; type: string }[],
  };
}

/** Autosave: guarda el título y la descripción de una actividad. */
export async function saveTask(taskId: string, html: string, title: string, executedAt: string | null = null) {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  // Una sola consulta: la actividad y el estado (y proyecto) de su reporte
  const task = await prisma.reportTask.findUnique({
    where: { id: taskId },
    include: { report: { select: { status: true, projectId: true } } },
  });
  if (!task || !hasProjectAccess(user, task.report.projectId)) throw new Error("Tarea no encontrada");
  if (!EDITABLE.includes(task.report.status)) throw new Error("El reporte ya no es editable");

  const cleanTitle = title.trim().slice(0, 191) || null;
  const cleanWhen = executedAt && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(executedAt) && !Number.isNaN(Date.parse(executedAt.replace(" ", "T"))) ? executedAt : null;
  if (task.descriptionHtml === html && task.title === cleanTitle && task.executedAt === cleanWhen) return { savedAt: new Date().toISOString() }; // sin cambios

  await prisma.reportTask.update({ where: { id: taskId }, data: { descriptionHtml: html, title: cleanTitle, executedAt: cleanWhen } });

  // El autosave dispara muchas veces: una sola entrada de historial por cada 10 min de edición,
  // y su hora solo se refresca como máximo una vez por minuto (menos escrituras en la base de datos)
  const action = `EDITED_TASK_${task.sequentialNum}`;
  const recent = await prisma.auditLog.findFirst({
    where: { reportId: task.reportId, userId: user.id, action, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  if (!recent) await prisma.auditLog.create({ data: { reportId: task.reportId, userId: user.id, action } });
  else if (Date.now() - recent.createdAt.getTime() > 60_000) {
    await prisma.auditLog.update({ where: { id: recent.id }, data: { createdAt: new Date() } });
  }
  return { savedAt: new Date().toISOString() };
}

const splitEmails = (s: string) => s.split(/[,;\s]+/).filter(Boolean);
const dmy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** Envía el PDF por Gmail a los correos del cliente y del proyecto; deja el reporte en ENVIADO. Admin, Editor y TEAM 311 (en sus proyectos). */
export async function sendReport(reportId: string): Promise<{ error?: string; dryRun?: boolean }> {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true, project: true },
  });
  if (!report || !hasProjectAccess(user, report.projectId)) return { error: "Reporte no encontrado" };
  if (report.status !== "APROBADO") return { error: "Solo se pueden enviar reportes aprobados" };

  // Reciben el reporte: correos principales del cliente, correos del proyecto y el contacto principal.
  // El contacto de administración y facturación NO lo recibe (su correo es solo para facturas).
  const to = Array.from(
    new Set([
      ...splitEmails(report.client.mainEmails),
      ...splitEmails(report.project.projectEmails),
      ...(report.client.contactEmail ? [report.client.contactEmail] : []),
    ].map((e) => e.toLowerCase())),
  );
  if (to.length === 0) return { error: "El cliente y el proyecto no tienen correos" };

  try {
    const { buffer, folio } = await getReportPdf(reportId);
    const logo = await readLogo311();
    const mail = reportEmail({
      clientName: report.client.companyName,
      folio,
      projectName: report.project.projectName,
      startDate: dmy(report.startDate),
      endDate: dmy(report.endDate),
      // Al abrirlo sin sesión, el sistema pasa por el login y luego llega a este reporte
      link: `${await getBaseUrl()}/reportes/${report.id}`,
      phrase: await nextFrase(),
      withLogo: !!logo,
    });
    const { dryRun } = await sendMail({
      to,
      ...mail,
      inline: logo
        ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }]
        : undefined,
      attachment: { filename: `${folio}.pdf`, content: buffer },
    });

    await prisma.report.update({ where: { id: reportId }, data: { status: "ENVIADO" } });
    await prisma.auditLog.create({
      data: { reportId, userId: user.id, action: "STATUS_CHANGE_ENVIADO", details: auditDetails({ to, dryRun }) },
    });
    revalidatePath(`/reportes/${reportId}`);
    revalidatePath("/");
    return { dryRun };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo enviar el correo" };
  }
}

/** Direcciones que se avisan cuando un TEAM 311 termina un reporte (configurable con TEAM_NOTIFY_EMAILS). */
const teamNotifyEmails = () =>
  (process.env.TEAM_NOTIFY_EMAILS ?? "admon@311consultores.com,necesito@311consultores.com").split(/[,;\s]+/).filter(Boolean);

export async function changeStatus(reportId: string, to: ReportStatus, comment?: string) {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { _count: { select: { tasks: true } }, client: { select: { companyName: true } }, project: { select: { projectName: true } } },
  });
  if (!report || !hasProjectAccess(user, report.projectId)) return { error: "Reporte no encontrado" };

  const from = report.status;
  const isAdmin = user.role === "ADMIN";
  let data: Prisma.ReportUpdateInput;

  if (to === "TERMINADO" && EDITABLE.includes(from)) {
    if (report._count.tasks === 0) return { error: "Agrega al menos una actividad antes de terminar" };
    data = { status: "TERMINADO", rejectionComment: null };
  } else if (to === "APROBADO" && from === "TERMINADO" && isAdmin) {
    data = { status: "APROBADO" };
  } else if (to === "RECHAZADO" && from === "TERMINADO" && isAdmin) {
    if (!comment?.trim()) return { error: "Indica el motivo del rechazo" };
    data = { status: "RECHAZADO", rejectionComment: comment.trim() };
  } else {
    return { error: "Transición no permitida" };
  }

  await prisma.report.update({ where: { id: reportId }, data });
  await prisma.auditLog.create({
    data: {
      reportId,
      userId: user.id,
      action: `STATUS_CHANGE_${to}`,
      details: auditDetails({ from, ...(comment ? { comment } : {}) }),
    },
  });
  revalidatePath(`/reportes/${reportId}`);
  revalidatePath("/");

  // Cuando un TEAM 311 termina un reporte se avisa a Administración para que lo revise (si el correo falla, el cambio ya quedó)
  if (to === "TERMINADO" && user.role === "TEAM_311") {
    try {
      const logo = await readLogo311();
      await sendMail({
        to: teamNotifyEmails(),
        ...reporteTerminadoEmail({
          folio: report.folio, clientName: report.client.companyName, projectName: report.project.projectName, teamName: user.name,
          link: `${await getBaseUrl()}/reportes/${report.id}`, withLogo: !!logo,
        }),
        inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined,
      });
    } catch (e) {
      console.error("[reporte terminado] no se pudo avisar:", e);
    }
  }
  return {};
}

/** El TEAM 311 elimina una actividad de un reporte que todavía se puede editar (sin pedir autorización). */
export async function deleteTaskDirect(taskId: string): Promise<{ error?: string }> {
  const user = await requireUser(["TEAM_311"]);
  const task = await prisma.reportTask.findUnique({ where: { id: taskId }, include: { report: { select: { status: true, projectId: true } } } });
  if (!task || !hasProjectAccess(user, task.report.projectId)) return { error: "Actividad no encontrada" };
  if (!EDITABLE.includes(task.report.status)) return { error: "El reporte ya no es editable" };
  await deleteTaskAndRenumber(taskId, user.id, "Eliminada por el consultor");
  revalidatePath(`/reportes/${task.reportId}`);
  return {};
}

/** El TEAM 311 pide volver a editar un reporte Terminado. Admin o Editor lo aprueban (vuelve a En proceso) o lo rechazan. */
export async function requestEdit(reportId: string, reason: string): Promise<{ error?: string }> {
  const user = await requireUser(["TEAM_311"]);
  const text = reason.trim();
  if (text.length < 3) return { error: "Explica por qué necesitas editar el reporte" };
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { status: true, projectId: true } });
  if (!report || !hasProjectAccess(user, report.projectId)) return { error: "Reporte no encontrado" };
  if (report.status !== "TERMINADO") return { error: "Solo se puede pedir edición de un reporte Terminado" };
  if (await prisma.editRequest.findFirst({ where: { reportId, status: "PENDIENTE" } })) return { error: "Ya hay una solicitud pendiente para este reporte" };

  await prisma.editRequest.create({ data: { reportId, requestedById: user.id, reason: text.slice(0, 1000) } });
  await prisma.auditLog.create({ data: { reportId, userId: user.id, action: "EDIT_REQUESTED", details: auditDetails({ reason: text }) } });
  revalidatePath(`/reportes/${reportId}`);
  revalidatePath("/");
  revalidatePath("/eliminaciones");
  return {};
}

/** Admin o Editor resuelven una solicitud de edición. */
export async function resolveEditRequest(requestId: string, approve: boolean): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const req = await prisma.editRequest.findUnique({ where: { id: requestId }, include: { report: { select: { status: true } } } });
  if (!req || req.status !== "PENDIENTE") return { error: "La solicitud ya fue atendida" };

  if (approve && req.report.status !== "TERMINADO") {
    await prisma.editRequest.update({ where: { id: requestId }, data: { status: "RECHAZADO", reviewedById: user.id, resolvedAt: new Date() } });
    revalidatePath(`/reportes/${req.reportId}`);
    return { error: "El reporte ya no está Terminado; la solicitud se cerró" };
  }
  await prisma.$transaction(async (tx) => {
    await tx.editRequest.update({ where: { id: requestId }, data: { status: approve ? "APROBADO" : "RECHAZADO", reviewedById: user.id, resolvedAt: new Date() } });
    if (approve) {
      await tx.report.update({ where: { id: req.reportId }, data: { status: "EN_PROCESO", rejectionComment: null } });
      await tx.auditLog.create({ data: { reportId: req.reportId, userId: user.id, action: "STATUS_CHANGE_EN_PROCESO", details: auditDetails({ from: "TERMINADO", editRequest: requestId }) } });
    } else {
      await tx.auditLog.create({ data: { reportId: req.reportId, userId: user.id, action: "EDIT_REQUEST_REJECTED" } });
    }
  });
  revalidatePath(`/reportes/${req.reportId}`);
  revalidatePath("/");
  revalidatePath("/eliminaciones");
  return {};
}
