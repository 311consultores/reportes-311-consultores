"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type ReportStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { nextFolio } from "@/lib/folio";
import { getReportPdf } from "@/lib/pdf-queue";
import { sendMail } from "@/lib/mailer";
import { serializeConsultants, auditDetails } from "@/lib/consultants";
import { reportEmail } from "@/lib/email-templates";
import { readLogo311 } from "@/lib/branding";
import { nextFrase } from "@/lib/frases";
import { getBaseUrl } from "@/lib/base-url";

type State = { error?: string } | undefined;

const EDITABLE: ReportStatus[] = ["EN_PROCESO", "RECHAZADO"];

const toDate = (s: string) => new Date(`${s}T12:00:00`);

export async function createReport(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({
      clientId: z.string().uuid("Selecciona un cliente"),
      projectId: z.string().uuid("Selecciona un proyecto"),
      startDate: z.string().min(1, "Fecha inicial requerida"),
      endDate: z.string().min(1, "Fecha final requerida"),
      consultants: z.string().trim().min(1, "Indica al menos un consultor"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.endDate < d.startDate) return { error: "La fecha final no puede ser anterior a la inicial" };
  const project = await prisma.project.findFirst({ where: { id: d.projectId, clientId: d.clientId } });
  if (!project) return { error: "El proyecto no pertenece al cliente" };

  const consultants = d.consultants.split(",").map((s) => s.trim()).filter(Boolean);

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
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Reporte no encontrado");
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
    descriptionHtml: task.descriptionHtml,
    evidences: [] as { id: string; url: string; type: string }[],
  };
}

/** Autosave: guarda el título y la descripción de una actividad. */
export async function saveTask(taskId: string, html: string, title: string) {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  // Una sola consulta: la actividad y el estado de su reporte
  const task = await prisma.reportTask.findUnique({
    where: { id: taskId },
    include: { report: { select: { status: true } } },
  });
  if (!task) throw new Error("Tarea no encontrada");
  if (!EDITABLE.includes(task.report.status)) throw new Error("El reporte ya no es editable");

  const cleanTitle = title.trim().slice(0, 191) || null;
  if (task.descriptionHtml === html && task.title === cleanTitle) return { savedAt: new Date().toISOString() }; // sin cambios

  await prisma.reportTask.update({ where: { id: taskId }, data: { descriptionHtml: html, title: cleanTitle } });

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

/** Envía el PDF por Gmail a los correos del cliente y del proyecto; deja el reporte en ENVIADO. Admin y Editor. */
export async function sendReport(reportId: string): Promise<{ error?: string; dryRun?: boolean }> {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { client: true, project: true },
  });
  if (!report) return { error: "Reporte no encontrado" };
  if (report.status !== "APROBADO") return { error: "Solo se pueden enviar reportes aprobados" };

  const to = Array.from(new Set([...splitEmails(report.client.mainEmails), ...splitEmails(report.project.projectEmails)]));
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

export async function changeStatus(reportId: string, to: ReportStatus, comment?: string) {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { _count: { select: { tasks: true } } },
  });
  if (!report) return { error: "Reporte no encontrado" };

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
  return {};
}
