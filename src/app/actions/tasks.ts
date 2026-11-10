"use server";

import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { readLogo311 } from "@/lib/branding";
import { getBaseUrl } from "@/lib/base-url";
import { tareaAsignadaEmail, tareaDevueltaEmail, tareaParaRevisarEmail } from "@/lib/email-templates";
import { notifyUsers, taskManagerIds } from "@/lib/notifications";
import { ASSIGNABLE_ROLES, isTaskManager, STAFF_ROLES, TASK_MANAGER_ROLES } from "@/lib/roles";
import { isPublished, isWaiting } from "@/lib/task-visibility";
import { activateDependents, waitMs } from "@/lib/task-chain";
import { BOARD_ORDER_OPS, canMove, formatMx, parseMxInput, toMxInput } from "@/lib/tasks-shared";

type Result = { error?: string; ok?: boolean; taskId?: string; reviewId?: string };

/** Quien gestiona tareas: Admin, Editor y PROJECT 311. */
const isOps = (u: CurrentUser) => isTaskManager(u.role);

/** Direcciones que se avisan cuando una tarea queda lista para revisión (misma configuración que los reportes terminados). */
const reviewNotifyEmails = () =>
  (process.env.TEAM_NOTIFY_EMAILS ?? "admon@311consultores.com,necesito@311consultores.com").split(/[,;\s]+/).filter(Boolean);

/** Envía un correo con el logo de 311; si falla, la acción ya quedó hecha. */
async function notify(to: string[], build: (withLogo: boolean) => { subject: string; text: string; html: string }) {
  if (to.length === 0) return;
  try {
    const logo = await readLogo311();
    await sendMail({
      to,
      ...build(!!logo),
      inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined,
    });
  } catch (e) {
    console.error("[tareas] no se pudo enviar el aviso:", e);
  }
}

const taskLink = async (id: string) => `${await getBaseUrl()}/tareas?tarea=${id}`;

type TaskFormData = {
  clientId: string | null; projectId: string | null; areaId: string | null; title: string; descriptionHtml: string; dueAt: Date | null; publishAt: Date | null; assigneeIds: string[];
  resources: { title: string; url: string }[];
  subtasks: { id: string | null; title: string; assigneeId: string | null; dueAt: Date | null }[];
};
/** Datos de una tarea completa (todo lo obligatorio está presente). */
type FullTaskForm = TaskFormData & { clientId: string; projectId: string; areaId: string; dueAt: Date };
const isFull = (d: TaskFormData): d is FullTaskForm => !!d.clientId && !!d.projectId && !!d.areaId && !!d.dueAt && d.assigneeIds.length > 0;

/** Estados en los que se puede crear una tarea desde el «+» de cada columna. */
const CREATE_STATUSES: TaskStatus[] = ["BORRADOR", "PENDIENTE", "EN_PROCESO", "PARA_REVISAR"];
const COMPLETE_MSG = "Para mandarla al equipo completa el cliente, el proyecto, el área, la fecha de entrega y al menos una persona";

/**
 * Lee y valida los campos del formulario de tarea (crear y editar).
 * Un BORRADOR solo exige el nombre: todo lo demás puede quedar vacío hasta que se asigne al TEAM 311.
 */
async function parseTaskForm(fd: FormData, currentAreaId?: string | null, draft = false): Promise<{ error: string } | TaskFormData> {
  const rawClient = String(fd.get("clientId") ?? "");
  const rawProject = String(fd.get("projectId") ?? "");
  const rawArea = String(fd.get("areaId") ?? "");
  const clientId = /^[0-9a-f-]{36}$/i.test(rawClient) ? rawClient : null;
  const projectId = /^[0-9a-f-]{36}$/i.test(rawProject) ? rawProject : null;
  const areaId = /^[0-9a-f-]{36}$/i.test(rawArea) ? rawArea : null;
  const title = String(fd.get("title") ?? "").trim().slice(0, 191);
  const descriptionHtml = String(fd.get("descriptionHtml") ?? "");
  const dueRaw = String(fd.get("dueAt") ?? "").trim();
  const dueAt = parseMxInput(dueRaw);

  if (title.length < 2) return { error: "Escribe el nombre de la tarea" };
  if (!draft) {
    if (!clientId) return { error: "Selecciona un cliente" };
    if (!projectId) return { error: "Selecciona un proyecto" };
    if (!areaId) return { error: "Selecciona el área de la tarea" };
    if (!dueAt) return { error: "Indica la fecha y hora de entrega" };
  } else if (dueRaw && !dueAt) {
    return { error: "La fecha de entrega no es válida" };
  }
  // Solo áreas activas (la tarea puede conservar su área actual aunque ya esté desactivada)
  if (areaId && !(await prisma.area.findFirst({ where: { id: areaId, OR: [{ active: true }, ...(currentAreaId === areaId ? [{ id: areaId }] : [])] }, select: { id: true } }))) return { error: "El área elegida no está disponible" };
  if (projectId && !clientId) return { error: "Elige primero el cliente del proyecto" };
  if (clientId && projectId && !(await prisma.project.findFirst({ where: { id: projectId, clientId }, select: { id: true } }))) return { error: "El proyecto no pertenece al cliente" };
  if (clientId && !(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) return { error: "El cliente no existe" };

  // Programar aparición (opcional; no aplica a un borrador): una fecha pasada o inmediata equivale a «aparece ya»
  const pubRaw = draft ? "" : String(fd.get("publishAt") ?? "").trim();
  const pub = pubRaw ? parseMxInput(pubRaw) : null;
  if (pubRaw && !pub) return { error: "La fecha de aparición no es válida" };
  const publishAt = pub && pub.getTime() > Date.now() + 60_000 ? pub : null;
  if (publishAt && dueAt && publishAt >= dueAt) return { error: "La tarea debe aparecer antes de su fecha de entrega" };

  const wanted = [...new Set(fd.getAll("consultantIds").map(String).filter((s) => /^[0-9a-f-]{36}$/i.test(s)))];
  const team = await prisma.user.findMany({ where: { id: { in: wanted }, role: { in: ASSIGNABLE_ROLES }, active: true }, select: { id: true } });
  if (!draft && team.length === 0) return { error: "Asigna la tarea al menos a una persona" };

  // Recursos: pares título + link (los renglones vacíos se ignoran)
  const titles = fd.getAll("resourceTitle").map(String);
  const urls = fd.getAll("resourceUrl").map(String);
  const resources: { title: string; url: string }[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    const t = (titles[i] ?? "").trim();
    if (!url && !t) continue;
    if (!/^https?:\/\/[^\s]+$/i.test(url) || url.length > 1000) return { error: `El recurso «${t || url}» necesita un link válido (que empiece con http:// o https://)` };
    resources.push({ title: (t || url).slice(0, 191), url });
  }

  // Subtareas: nombre obligatorio; la persona debe ser una de las asignadas a la tarea; fecha opcional
  const assigneeIds = team.map((t) => t.id);
  const sTitles = fd.getAll("subTitle").map(String);
  const sIds = fd.getAll("subId").map(String);
  const sWho = fd.getAll("subAssignee").map(String);
  const sDue = fd.getAll("subDue").map(String);
  const subtasks: { id: string | null; title: string; assigneeId: string | null; dueAt: Date | null }[] = [];
  for (let i = 0; i < sTitles.length; i++) {
    const t = sTitles[i].trim().slice(0, 191);
    if (!t) continue;
    const due = sDue[i] ? parseMxInput(sDue[i]) : null;
    if (sDue[i] && !due) return { error: `La fecha de la subtarea «${t}» no es válida` };
    subtasks.push({ id: /^[0-9a-f-]{36}$/i.test(sIds[i] ?? "") ? sIds[i] : null, title: t, assigneeId: assigneeIds.includes(sWho[i]) ? sWho[i] : null, dueAt: due });
  }
  return { clientId, projectId, areaId, title, descriptionHtml, dueAt, publishAt, assigneeIds, resources, subtasks };
}

/** Aviso a quienes reciben una tarea (campanita, notificación del navegador y correo). */
async function announceTask(task: { id: string; title: string; clientName: string; projectName: string; dueAt: Date }, userIds: string[], byId: string, byName: string) {
  if (userIds.length === 0) return;
  const people = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { email: true } });
  await notifyUsers(userIds, { actorId: byId, kind: "TASK_ASSIGNED", title: `Nueva tarea: ${task.title}`, body: `${task.clientName} · ${task.projectName} — entrega ${formatMx(task.dueAt)}`, link: `/tareas?tarea=${task.id}` });
  const link = await taskLink(task.id);
  await notify(people.map((p) => p.email), (withLogo) =>
    tareaAsignadaEmail({ title: task.title, clientName: task.clientName, projectName: task.projectName, due: formatMx(task.dueAt), byName, link, withLogo }),
  );
}

/**
 * Crea una tarea (Admin, Editor y PROJECT 311). Por defecto nace en PENDIENTE; el «+» de cada columna la crea ya en esa fase
 * (campo «status»: BORRADOR, PENDIENTE, EN_PROCESO o PARA_REVISAR). Un BORRADOR solo pide el nombre y no avisa a nadie.
 */
export async function createTask(fd: FormData): Promise<Result> {
  const user = await requireUser(TASK_MANAGER_ROLES);
  const wantedStatus = String(fd.get("status") ?? "PENDIENTE") as TaskStatus;
  const status: TaskStatus = CREATE_STATUSES.includes(wantedStatus) ? wantedStatus : "PENDIENTE";
  const draft = status === "BORRADOR";

  // Tarea encadenada (Evolutivo 19): espera a que otra se apruebe; su plazo se da en días y horas desde esa aprobación
  const prevId = String(fd.get("prevTaskId") ?? "");
  let chain: { prevId: string; prevTitle: string; days: number; hours: number; prevDone: boolean } | null = null;
  if (prevId) {
    if (draft) return { error: "Un borrador no se puede encadenar: complétalo primero" };
    const prev = /^[0-9a-f-]{36}$/i.test(prevId) ? await prisma.task.findUnique({ where: { id: prevId }, select: { id: true, title: true, status: true, dueAt: true } }) : null;
    if (!prev) return { error: "La tarea anterior no existe" };
    if (prev.status === "BORRADOR") return { error: "La tarea anterior sigue en borradores" };
    const days = Math.floor(Number(fd.get("waitDays") ?? 0));
    const hours = Math.floor(Number(fd.get("waitHours") ?? 0));
    if (!Number.isFinite(days) || !Number.isFinite(hours) || days < 0 || days > 365 || hours < 0 || hours > 23) return { error: "El plazo no es válido (días de 0 a 365 y horas de 0 a 23)" };
    if (days === 0 && hours === 0) return { error: "Indica el plazo en días y/o horas para entregar la tarea encadenada" };
    const prevDone = prev.status === "TERMINADA";
    // Mientras espera, la fecha de entrega es solo una estimación (se recalcula al activarse)
    fd.set("dueAt", toMxInput(new Date(Math.max(prev.dueAt?.getTime() ?? 0, Date.now()) + waitMs(days, hours))));
    fd.delete("publishAt");
    chain = { prevId: prev.id, prevTitle: prev.title, days, hours, prevDone };
  }
  const d = await parseTaskForm(fd, undefined, draft);
  if ("error" in d) return { error: d.error };
  const waiting = !!chain && !chain.prevDone;
  const dueAt = chain?.prevDone ? new Date(Date.now() + waitMs(chain.days, chain.hours)) : d.dueAt; // si la anterior ya estaba aprobada, el plazo cuenta desde ahora

  const task = await prisma.task.create({
    data: {
      clientId: d.clientId, projectId: d.projectId, areaId: d.areaId, title: d.title, descriptionHtml: d.descriptionHtml, dueAt, publishAt: d.publishAt, createdById: user.id,
      status, ...(status === "PARA_REVISAR" ? { readyAt: new Date() } : {}),
      ...(chain ? { prevTaskId: chain.prevId, waitDays: chain.days, waitHours: chain.hours, activatedAt: waiting ? null : new Date() } : {}),
      assignees: { create: d.assigneeIds.map((userId) => ({ userId })) },
      resources: { create: d.resources.map((r, position) => ({ ...r, position })) },
      subtasks: { create: d.subtasks.map((s, position) => ({ title: s.title, assigneeId: s.assigneeId, dueAt: s.dueAt, position })) },
      events: { create: { userId: user.id, kind: "CREATED", note: draft ? "Guardada como borrador" : chain ? (waiting ? `Encadenada: en espera de «${chain.prevTitle}»` : `Encadenada a «${chain.prevTitle}» (ya estaba aprobada)`) : status !== "PENDIENTE" ? `Creada en ${status}` : null } },
    },
    include: { client: { select: { companyName: true } }, project: { select: { projectName: true } } },
  });

  // Un borrador no avisa a nadie; una tarea programada no avisa ahora (sale cuando aparece) y una encadenada en espera avisa cuando se activa
  if (!draft && !d.publishAt && !waiting && task.dueAt) {
    await announceTask({ id: task.id, title: task.title, clientName: task.client?.companyName ?? "", projectName: task.project?.projectName ?? "", dueAt: task.dueAt }, d.assigneeIds, user.id, user.name);
  }
  revalidatePath("/tareas");
  return { ok: true, taskId: task.id };
}

/**
 * Edita una tarea (Admin, Editor y PROJECT 311): nombre, fecha, descripción, personas y recursos.
 * Un borrador se guarda incompleto («status» = BORRADOR) o se manda al equipo con «status» = PENDIENTE (entonces todo es obligatorio y se avisa a las personas).
 */
export async function updateTask(taskId: string, fd: FormData): Promise<Result> {
  const user = await requireUser(TASK_MANAGER_ROLES);
  const current = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!current) return { error: "La tarea no existe" };
  const wasDraft = current.status === "BORRADOR";
  const wantedStatus = String(fd.get("status") ?? "BORRADOR") as TaskStatus;
  const promoteTo: TaskStatus | null = wasDraft && wantedStatus !== "BORRADOR" && CREATE_STATUSES.includes(wantedStatus) ? wantedStatus : null;
  const stayDraft = wasDraft && !promoteTo;

  // Una tarea en espera se edita con su plazo (días y horas) en lugar de una fecha fija
  let waitPatch: { waitDays: number; waitHours: number } | null = null;
  if (isWaiting(current)) {
    const days = Math.floor(Number(fd.get("waitDays") ?? current.waitDays ?? 0));
    const hours = Math.floor(Number(fd.get("waitHours") ?? current.waitHours ?? 0));
    if (!Number.isFinite(days) || !Number.isFinite(hours) || days < 0 || days > 365 || hours < 0 || hours > 23 || (days === 0 && hours === 0)) return { error: "El plazo no es válido (días de 0 a 365 y horas de 0 a 23; al menos uno mayor a 0)" };
    waitPatch = { waitDays: days, waitHours: hours };
    fd.set("dueAt", toMxInput(new Date((current.dueAt ?? new Date()).getTime() - waitMs(current.waitDays, current.waitHours) + waitMs(days, hours))));
    fd.delete("publishAt");
  }
  const d = await parseTaskForm(fd, current.areaId, stayDraft);
  if ("error" in d) return { error: d.error };

  const existingSubtasks = await prisma.subtask.findMany({ where: { taskId }, select: { id: true } });

  // Borrador que sigue siendo borrador: se guarda tal cual, sin avisos
  if (stayDraft) {
    await prisma.$transaction([
      prisma.task.update({ where: { id: taskId }, data: { clientId: d.clientId, projectId: d.projectId, areaId: d.areaId, title: d.title, descriptionHtml: d.descriptionHtml, dueAt: d.dueAt } }),
      prisma.taskAssignee.deleteMany({ where: { taskId } }),
      prisma.taskAssignee.createMany({ data: d.assigneeIds.map((userId) => ({ taskId, userId })) }),
      prisma.taskResource.deleteMany({ where: { taskId } }),
      prisma.taskResource.createMany({ data: d.resources.map((r, position) => ({ ...r, taskId, position })) }),
      ...subtaskOps(taskId, d.subtasks, existingSubtasks),
      prisma.taskEvent.create({ data: { taskId, userId: user.id, kind: "EDITED", note: "Editó el borrador" } }),
    ]);
    revalidatePath("/tareas");
    return { ok: true, taskId };
  }
  if (!isFull(d)) return { error: COMPLETE_MSG };

  const before = new Set(current.assignees.map((a) => a.userId));
  const added = d.assigneeIds.filter((id) => !before.has(id));
  // La fecha de aparición solo se puede cambiar mientras la tarea no aparece (o al sacarla de borradores); si se quita, aparece de inmediato
  const wasPublished = isPublished(current);
  const publishAtEditable = !wasPublished || wasDraft;
  const publishAt = publishAtEditable ? d.publishAt : current.publishAt;
  const publishesNow = promoteTo ? !publishAt : !wasPublished && !publishAt;
  const cronWillNotify = !wasDraft && wasPublished && current.publishAt !== null && current.publishNotifiedAt === null; // ya apareció pero el aviso aún no sale
  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: {
        clientId: d.clientId, projectId: d.projectId, areaId: d.areaId, title: d.title, descriptionHtml: d.descriptionHtml, dueAt: d.dueAt, ...(waitPatch ?? {}),
        ...(publishAtEditable ? { publishAt, publishNotifiedAt: null } : {}),
        ...(promoteTo ? { status: promoteTo, ...(promoteTo === "PARA_REVISAR" ? { readyAt: new Date() } : {}) } : {}),
      },
    }),
    prisma.taskAssignee.deleteMany({ where: { taskId } }),
    prisma.taskAssignee.createMany({ data: d.assigneeIds.map((userId) => ({ taskId, userId })) }),
    prisma.taskResource.deleteMany({ where: { taskId } }),
    prisma.taskResource.createMany({ data: d.resources.map((r, position) => ({ ...r, taskId, position })) }),
    ...subtaskOps(taskId, d.subtasks, existingSubtasks),
    prisma.taskEvent.create({ data: { taskId, userId: user.id, kind: promoteTo ? "MOVED" : "EDITED", note: promoteTo ? `BORRADOR → ${promoteTo}` : null } }),
  ]);

  // Avisos: a las personas nuevas si la tarea ya es visible; a todas si acaba de publicarse o salió de borradores; a nadie si sigue programada
  const stillWaiting = isWaiting(current);
  const toNotify = stillWaiting ? [] : publishesNow ? d.assigneeIds : !promoteTo && wasPublished && !cronWillNotify ? added : [];
  if (publishesNow) await prisma.task.update({ where: { id: taskId }, data: { publishNotifiedAt: new Date() } });
  if (toNotify.length) {
    const ctx = await prisma.project.findUnique({ where: { id: d.projectId }, select: { projectName: true, client: { select: { companyName: true } } } });
    await announceTask({ id: taskId, title: d.title, clientName: ctx?.client.companyName ?? "", projectName: ctx?.projectName ?? "", dueAt: d.dueAt }, toNotify, user.id, user.name);
  }
  revalidatePath("/tareas");
  return { ok: true, taskId };
}

/**
 * Mueve una tarea de fase. El TEAM 311 asignado solo avanza (Pendiente ↔ En proceso → Para revisar);
 * Admin y Editor mueven a cualquier fase. Al terminar se puede habilitar la «sorpresa» de felicitación;
 * al devolver de «Para revisar» a «En proceso» el comentario es obligatorio.
 */
export async function moveTask(taskId: string, to: TaskStatus, opts: { note?: string; surprise?: boolean } = {}): Promise<Result> {
  const user = await requireUser(STAFF_ROLES);
  if (!BOARD_ORDER_OPS.includes(to)) return { error: "Fase no válida" };
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true, user: { select: { email: true } } } }, client: { select: { companyName: true } }, project: { select: { projectName: true } } },
  });
  if (!task) return { error: "La tarea no existe" };
  const mine = task.assignees.some((a) => a.userId === user.id);
  if (!isOps(user) && (!mine || !isPublished(task))) return { error: "Esa tarea no es tuya" };
  if (isWaiting(task)) {
    const prev = task.prevTaskId ? await prisma.task.findUnique({ where: { id: task.prevTaskId }, select: { title: true } }) : null;
    return { error: `Esta tarea está en espera: se activa cuando se apruebe «${prev?.title ?? "la tarea anterior"}»` };
  }
  if (!canMove(user.role, mine, task.status, to)) return { error: "No puedes mover la tarea a esa fase" };
  // Sacar una tarea de BORRADORES la manda al equipo: debe estar completa
  if (task.status === "BORRADOR" && to !== "BORRADOR" && !(task.clientId && task.projectId && task.areaId && task.dueAt && task.assignees.length > 0)) return { error: COMPLETE_MSG };

  const note = opts.note?.trim().slice(0, 2000) || null;
  const from = task.status;
  const returning = from === "PARA_REVISAR" && to === "EN_PROCESO";
  if (returning && !note) return { error: "Escribe un comentario para devolver la tarea" };

  const now = new Date();
  const data: Record<string, unknown> = { status: to };
  let kind = "MOVED";
  if (to === "PARA_REVISAR") { data.readyAt = now; kind = "READY"; }
  if (to === "TERMINADA") { data.acceptedAt = now; data.surprise = !!opts.surprise; data.surpriseOpenedAt = null; data.hiddenAt = null; kind = "ACCEPTED"; }
  if (from === "TERMINADA" && to !== "TERMINADA") { data.acceptedAt = null; data.surprise = false; data.surpriseOpenedAt = null; data.hiddenAt = null; }
  if (returning) kind = "RETURNED";

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data }),
    prisma.taskEvent.create({ data: { taskId, userId: user.id, kind, note: note ?? (kind === "MOVED" ? `${from} → ${to}` : null) } }),
  ]);

  const link = await taskLink(taskId);
  const path = `/tareas?tarea=${taskId}`;
  const assigneeIds = task.assignees.map((a) => a.userId);
  if (to === "PARA_REVISAR" && !isOps(user)) {
    await notifyUsers((await taskManagerIds()).filter((id) => id !== user.id), { actorId: user.id, kind: "TASK_READY", title: `Tarea lista para revisar: ${task.title}`, body: `${user.name}${note ? ` — ${note}` : ""}`, link: path });
  }
  if (to === "TERMINADA") {
    await notifyUsers(assigneeIds, { actorId: user.id, kind: "TASK_ACCEPTED", title: `🎉 ¡Tu tarea fue aceptada!: ${task.title}`, body: note, link: path });
  }
  if (returning) {
    await notifyUsers(assigneeIds, { actorId: user.id, kind: "TASK_RETURNED", title: `Tu tarea volvió a «En proceso»: ${task.title}`, body: note, link: path });
  }
  // De borrador a una fase de trabajo: se avisa a las personas asignadas como si fuera una tarea nueva (si no es programada)
  if (from === "BORRADOR" && to !== "BORRADOR" && task.dueAt) {
    const publishesNow = !task.publishAt || task.publishAt <= now;
    if (publishesNow) {
      await prisma.task.update({ where: { id: taskId }, data: { publishNotifiedAt: now } });
      await announceTask({ id: taskId, title: task.title, clientName: task.client?.companyName ?? "", projectName: task.project?.projectName ?? "", dueAt: task.dueAt }, assigneeIds, user.id, user.name);
    }
  }
  if (to === "PARA_REVISAR" && !isOps(user)) {
    await notify(reviewNotifyEmails(), (withLogo) =>
      tareaParaRevisarEmail({ title: task.title, teamName: user.name, clientName: task.client?.companyName ?? "", projectName: task.project?.projectName ?? "", note, link, withLogo }),
    );
  }
  // Al aprobar, se activan las tareas encadenadas que esperaban a esta (su plazo cuenta desde este instante)
  if (to === "TERMINADA") await activateDependents(taskId, { actorId: user.id, reason: "APROBADA", prevTitle: task.title });
  if (returning) {
    await notify(task.assignees.map((a) => a.user.email), (withLogo) => tareaDevueltaEmail({ title: task.title, byName: user.name, note: note ?? "", link, withLogo }));
  }
  revalidatePath("/tareas");
  return { ok: true, taskId };
}

/** «Limpiar terminadas» (Admin y Editor): oculta del tablero las tareas terminadas; siguen en el historial. */
export async function clearFinished(): Promise<{ count: number }> {
  await requireUser(TASK_MANAGER_ROLES);
  const r = await prisma.task.updateMany({ where: { status: "TERMINADA", hiddenAt: null }, data: { hiddenAt: new Date() } });
  revalidatePath("/tareas");
  return { count: r.count };
}

/** El TEAM 311 abre la sorpresa de una tarea aceptada: se marca como revelada. */
export async function openSurprise(taskId: string): Promise<Result> {
  const user = await requireUser(["TEAM_311"]);
  const r = await prisma.task.updateMany({
    where: { id: taskId, status: "TERMINADA", surprise: true, surpriseOpenedAt: null, assignees: { some: { userId: user.id } } },
    data: { surpriseOpenedAt: new Date() },
  });
  revalidatePath("/tareas");
  return r.count ? { ok: true } : { error: "La sorpresa ya se abrió o no está disponible" };
}

/** Cambia la fecha de entrega arrastrando la tarea a otro día del calendario (solo Admin y Editor); conserva la hora. */
export async function rescheduleTask(taskId: string, day: string): Promise<Result> {
  const user = await requireUser(TASK_MANAGER_ROLES);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Fecha no válida" };
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: { select: { userId: true } } } });
  if (!task) return { error: "La tarea no existe" };
  if (isWaiting(task)) return { error: "La tarea está en espera: su fecha se calcula cuando se apruebe la anterior" };
  if (!task.dueAt) return { error: "Esta tarea aún no tiene fecha de entrega: asígnala al editarla" };
  const time = toMxInput(task.dueAt).slice(11, 16);
  const next = parseMxInput(`${day}T${time}`);
  if (!next) return { error: "Fecha no válida" };
  if (next.getTime() === task.dueAt.getTime()) return { ok: true };
  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { dueAt: next, reminderSentAt: null } }),
    prisma.taskEvent.create({ data: { taskId, userId: user.id, kind: "EDITED", note: `Fecha de entrega: ${formatMx(task.dueAt)} → ${formatMx(next)}` } }),
  ]);
  await notifyUsers(task.assignees.map((a) => a.userId), { actorId: user.id, kind: "TASK_ASSIGNED", title: `Cambió la fecha de entrega: ${task.title}`, body: `Nueva entrega: ${formatMx(next)}`, link: `/tareas?tarea=${taskId}` });
  revalidatePath("/tareas");
  return { ok: true, taskId };
}

/** Operaciones para dejar las subtareas como llegaron del formulario: conserva (y actualiza) las existentes, crea las nuevas y borra las quitadas. */
function subtaskOps(taskId: string, incoming: { id: string | null; title: string; assigneeId: string | null; dueAt: Date | null }[], existing: { id: string }[]) {
  const have = new Set(existing.map((e) => e.id));
  const keep = new Set(incoming.filter((s) => s.id && have.has(s.id)).map((s) => s.id as string));
  return [
    prisma.subtask.deleteMany({ where: { taskId, id: { notIn: [...keep] } } }),
    ...incoming.map((s, position) =>
      s.id && have.has(s.id)
        ? prisma.subtask.update({ where: { id: s.id }, data: { title: s.title, assigneeId: s.assigneeId, dueAt: s.dueAt, position } })
        : prisma.subtask.create({ data: { taskId, title: s.title, assigneeId: s.assigneeId, dueAt: s.dueAt, position } }),
    ),
  ];
}

/** Marca o desmarca una subtarea. Admin y Editor siempre; el TEAM 311 asignado, mientras la tarea no esté terminada. Queda en el historial. */
export async function toggleSubtask(subtaskId: string, done: boolean): Promise<Result> {
  const user = await requireUser(STAFF_ROLES);
  const sub = await prisma.subtask.findUnique({ where: { id: subtaskId }, include: { task: { include: { assignees: { select: { userId: true } } } } } });
  if (!sub) return { error: "La subtarea no existe" };
  if (isWaiting(sub.task)) return { error: "La tarea está en espera de que se apruebe la anterior: aún no se pueden marcar subtareas" };
  const ops = isOps(user);
  if (!ops) {
    if (!sub.task.assignees.some((a) => a.userId === user.id) || !isPublished(sub.task)) return { error: "Esa tarea no es tuya" };
    if (sub.task.status === "TERMINADA") return { error: "La tarea ya fue aceptada: solo puedes consultarla" };
  }
  if (sub.done === done) return { ok: true, taskId: sub.taskId };
  await prisma.$transaction([
    prisma.subtask.update({ where: { id: subtaskId }, data: { done, doneAt: done ? new Date() : null, doneById: done ? user.id : null } }),
    prisma.taskEvent.create({ data: { taskId: sub.taskId, userId: user.id, kind: "SUBTASK", note: `${done ? "✔ Marcó" : "↩ Desmarcó"}: ${sub.title}` } }),
    // Si es el ajuste de una revisión, el comentario del cliente queda resuelto (o vuelve a pendiente)
    ...(sub.reviewCommentId
      ? [prisma.reviewComment.updateMany({ where: { id: sub.reviewCommentId }, data: { resolvedAt: done ? new Date() : null, resolvedById: done ? user.id : null, ...(done ? {} : { resolvedNote: null }) } })]
      : []),
  ]);
  revalidatePath("/tareas");
  if (sub.task.reviewId) revalidatePath(`/revisiones/${sub.task.reviewId}`);
  // Al marcar la última subtarea de una tarea de revisión se avisa para que se envíen los ajustes al cliente
  if (done && sub.task.reviewId && (await prisma.subtask.count({ where: { taskId: sub.taskId, done: false } })) === 0) {
    return { ok: true, taskId: sub.taskId, reviewId: sub.task.reviewId };
  }
  return { ok: true, taskId: sub.taskId };
}

/** Agrega personas a una tarea sin abrir «Editar» (Admin, Editor y PROJECT 311). Avisa a quien se agrega si la tarea ya es visible. */
export async function addTaskAssignees(taskId: string, userIds: string[]): Promise<Result> {
  const user = await requireUser(TASK_MANAGER_ROLES);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } }, client: { select: { companyName: true } }, project: { select: { projectName: true } } },
  });
  if (!task) return { error: "La tarea no existe" };
  const have = new Set(task.assignees.map((a) => a.userId));
  const wanted = [...new Set(userIds.filter((s) => /^[0-9a-f-]{36}$/i.test(s) && !have.has(s)))];
  const people = await prisma.user.findMany({ where: { id: { in: wanted }, role: { in: ASSIGNABLE_ROLES }, active: true }, select: { id: true, name: true, email: true } });
  if (people.length === 0) return { error: "Elige al menos una persona que no esté ya asignada" };
  await prisma.$transaction([
    prisma.taskAssignee.createMany({ data: people.map((p) => ({ taskId, userId: p.id })) }),
    prisma.taskEvent.create({ data: { taskId, userId: user.id, kind: "EDITED", note: `Agregó a: ${people.map((p) => p.name).join(", ")}` } }),
  ]);
  // Si la tarea es programada y todavía no aparece (o el aviso general aún no sale), el aviso llega al publicarse
  // Un borrador no avisa a nadie hasta que se manda al equipo
  if (task.status !== "BORRADOR" && task.dueAt && isPublished(task) && (task.publishAt === null || task.publishNotifiedAt !== null)) {
    await announceTask({ id: taskId, title: task.title, clientName: task.client?.companyName ?? "", projectName: task.project?.projectName ?? "", dueAt: task.dueAt }, people.map((p) => p.id), user.id, user.name);
  }
  revalidatePath("/tareas");
  return { ok: true, taskId };
}

/** Quita a una persona de una tarea (Admin, Editor y PROJECT 311). La tarea debe conservar al menos una persona. */
export async function removeTaskAssignee(taskId: string, userId: string): Promise<Result> {
  const user = await requireUser(TASK_MANAGER_ROLES);
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: { include: { user: { select: { name: true } } } } } });
  if (!task) return { error: "La tarea no existe" };
  const target = task.assignees.find((a) => a.userId === userId);
  if (!target) return { error: "Esa persona ya no está asignada" };
  if (task.assignees.length <= 1 && task.status !== "BORRADOR") return { error: "La tarea debe tener al menos una persona asignada" };
  await prisma.$transaction([
    prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } }),
    prisma.subtask.updateMany({ where: { taskId, assigneeId: userId }, data: { assigneeId: null } }),
    prisma.taskEvent.create({ data: { taskId, userId: user.id, kind: "EDITED", note: `Quitó a: ${target.user.name}` } }),
  ]);
  if (task.status !== "BORRADOR" && isPublished(task) && (task.publishAt === null || task.publishNotifiedAt !== null)) {
    await notifyUsers([userId], { actorId: user.id, kind: "TASK_UNASSIGNED", title: `Ya no tienes asignada la tarea: ${task.title}`, body: `${user.name} te quitó de la tarea`, link: "/tareas" });
  }
  revalidatePath("/tareas");
  return { ok: true, taskId };
}
