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
import { isPublished } from "@/lib/task-visibility";
import { canMove, formatMx, parseMxInput, STATUS_ORDER, toMxInput } from "@/lib/tasks-shared";

type Result = { error?: string; ok?: boolean; taskId?: string };

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

/** Lee y valida los campos del formulario de tarea (crear y editar). */
async function parseTaskForm(fd: FormData, currentAreaId?: string | null): Promise<{ error: string } | {
  clientId: string; projectId: string; areaId: string; title: string; descriptionHtml: string; dueAt: Date; publishAt: Date | null; assigneeIds: string[];
  resources: { title: string; url: string }[];
  subtasks: { id: string | null; title: string; assigneeId: string | null; dueAt: Date | null }[];
}> {
  const clientId = String(fd.get("clientId") ?? "");
  const projectId = String(fd.get("projectId") ?? "");
  const areaId = String(fd.get("areaId") ?? "");
  const title = String(fd.get("title") ?? "").trim().slice(0, 191);
  const descriptionHtml = String(fd.get("descriptionHtml") ?? "");
  const dueAt = parseMxInput(String(fd.get("dueAt") ?? ""));

  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return { error: "Selecciona un cliente" };
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return { error: "Selecciona un proyecto" };
  if (!/^[0-9a-f-]{36}$/i.test(areaId)) return { error: "Selecciona el área de la tarea" };
  // Solo áreas activas (la tarea puede conservar su área actual aunque ya esté desactivada)
  if (!(await prisma.area.findFirst({ where: { id: areaId, OR: [{ active: true }, ...(currentAreaId === areaId ? [{ id: areaId }] : [])] }, select: { id: true } }))) return { error: "El área elegida no está disponible" };
  if (title.length < 2) return { error: "Escribe el nombre de la tarea" };
  if (!dueAt) return { error: "Indica la fecha y hora de entrega" };
  // Programar aparición (opcional): una fecha pasada o inmediata equivale a «aparece ya»
  const pubRaw = String(fd.get("publishAt") ?? "").trim();
  const pub = pubRaw ? parseMxInput(pubRaw) : null;
  if (pubRaw && !pub) return { error: "La fecha de aparición no es válida" };
  const publishAt = pub && pub.getTime() > Date.now() + 60_000 ? pub : null;
  if (publishAt && publishAt >= dueAt) return { error: "La tarea debe aparecer antes de su fecha de entrega" };
  if (!(await prisma.project.findFirst({ where: { id: projectId, clientId }, select: { id: true } }))) return { error: "El proyecto no pertenece al cliente" };

  const wanted = [...new Set(fd.getAll("consultantIds").map(String).filter((s) => /^[0-9a-f-]{36}$/i.test(s)))];
  const team = await prisma.user.findMany({ where: { id: { in: wanted }, role: { in: ASSIGNABLE_ROLES }, active: true }, select: { id: true } });
  if (team.length === 0) return { error: "Asigna la tarea al menos a una persona" };

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

/** Crea una tarea (Admin, Editor y PROJECT 311). Nace en PENDIENTE y se avisa por correo a quienes la reciben. */
export async function createTask(fd: FormData): Promise<Result> {
  const user = await requireUser(TASK_MANAGER_ROLES);
  const d = await parseTaskForm(fd);
  if ("error" in d) return { error: d.error };

  const task = await prisma.task.create({
    data: {
      clientId: d.clientId, projectId: d.projectId, areaId: d.areaId, title: d.title, descriptionHtml: d.descriptionHtml, dueAt: d.dueAt, publishAt: d.publishAt, createdById: user.id,
      assignees: { create: d.assigneeIds.map((userId) => ({ userId })) },
      resources: { create: d.resources.map((r, position) => ({ ...r, position })) },
      subtasks: { create: d.subtasks.map((s, position) => ({ title: s.title, assigneeId: s.assigneeId, dueAt: s.dueAt, position })) },
      events: { create: { userId: user.id, kind: "CREATED" } },
    },
    include: { client: { select: { companyName: true } }, project: { select: { projectName: true } }, assignees: { include: { user: { select: { email: true } } } } },
  });

  // Una tarea programada no avisa ahora: el aviso sale cuando aparece (lo hace la tarea programada de cada hora)
  if (!d.publishAt) {
    await notifyUsers(d.assigneeIds, { actorId: user.id, kind: "TASK_ASSIGNED", title: `Nueva tarea: ${task.title}`, body: `${task.client.companyName} · ${task.project.projectName} — entrega ${formatMx(task.dueAt)}`, link: `/tareas?tarea=${task.id}` });
    const link = await taskLink(task.id);
    await notify(task.assignees.map((a) => a.user.email), (withLogo) =>
      tareaAsignadaEmail({ title: task.title, clientName: task.client.companyName, projectName: task.project.projectName, due: formatMx(task.dueAt), byName: user.name, link, withLogo }),
    );
  }
  revalidatePath("/tareas");
  return { ok: true, taskId: task.id };
}

/** Edita una tarea (solo Admin y Editor): nombre, fecha, descripción, personas y recursos. */
export async function updateTask(taskId: string, fd: FormData): Promise<Result> {
  const user = await requireUser(TASK_MANAGER_ROLES);
  const current = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!current) return { error: "La tarea no existe" };
  const d = await parseTaskForm(fd, current.areaId);
  if ("error" in d) return { error: d.error };

  const existingSubtasks = await prisma.subtask.findMany({ where: { taskId }, select: { id: true } });
  const before = new Set(current.assignees.map((a) => a.userId));
  const added = d.assigneeIds.filter((id) => !before.has(id));
  // La fecha de aparición solo se puede cambiar mientras la tarea no aparece; si se quita, aparece de inmediato
  const wasPublished = isPublished(current);
  const publishAt = wasPublished ? current.publishAt : d.publishAt;
  const publishesNow = !wasPublished && !publishAt;
  const cronWillNotify = wasPublished && current.publishAt !== null && current.publishNotifiedAt === null; // ya apareció pero el aviso aún no sale
  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { clientId: d.clientId, projectId: d.projectId, areaId: d.areaId, title: d.title, descriptionHtml: d.descriptionHtml, dueAt: d.dueAt, ...(wasPublished ? {} : { publishAt, publishNotifiedAt: null }) } }),
    prisma.taskAssignee.deleteMany({ where: { taskId } }),
    prisma.taskAssignee.createMany({ data: d.assigneeIds.map((userId) => ({ taskId, userId })) }),
    prisma.taskResource.deleteMany({ where: { taskId } }),
    prisma.taskResource.createMany({ data: d.resources.map((r, position) => ({ ...r, taskId, position })) }),
    ...subtaskOps(taskId, d.subtasks, existingSubtasks),
    prisma.taskEvent.create({ data: { taskId, userId: user.id, kind: "EDITED" } }),
  ]);

  // Avisos: a las personas nuevas si la tarea ya es visible; a todas si acaba de publicarse; a nadie si sigue programada
  const toNotify = publishesNow ? d.assigneeIds : wasPublished && !cronWillNotify ? added : [];
  if (publishesNow) await prisma.task.update({ where: { id: taskId }, data: { publishNotifiedAt: new Date() } });
  if (toNotify.length) {
    const [people, ctx] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: toNotify } }, select: { email: true } }),
      prisma.project.findUnique({ where: { id: d.projectId }, select: { projectName: true, client: { select: { companyName: true } } } }),
    ]);
    await notifyUsers(toNotify, { actorId: user.id, kind: "TASK_ASSIGNED", title: `Nueva tarea: ${d.title}`, body: `${ctx?.client.companyName ?? ""} · ${ctx?.projectName ?? ""} — entrega ${formatMx(d.dueAt)}`, link: `/tareas?tarea=${taskId}` });
    const link = await taskLink(taskId);
    await notify(people.map((p) => p.email), (withLogo) =>
      tareaAsignadaEmail({ title: d.title, clientName: ctx?.client.companyName ?? "", projectName: ctx?.projectName ?? "", due: formatMx(d.dueAt), byName: user.name, link, withLogo }),
    );
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
  if (!STATUS_ORDER.includes(to)) return { error: "Fase no válida" };
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true, user: { select: { email: true } } } }, client: { select: { companyName: true } }, project: { select: { projectName: true } } },
  });
  if (!task) return { error: "La tarea no existe" };
  const mine = task.assignees.some((a) => a.userId === user.id);
  if (!isOps(user) && (!mine || !isPublished(task))) return { error: "Esa tarea no es tuya" };
  if (!canMove(user.role, mine, task.status, to)) return { error: "No puedes mover la tarea a esa fase" };

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
  if (to === "PARA_REVISAR" && !isOps(user)) {
    await notify(reviewNotifyEmails(), (withLogo) =>
      tareaParaRevisarEmail({ title: task.title, teamName: user.name, clientName: task.client.companyName, projectName: task.project.projectName, note, link, withLogo }),
    );
  }
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
  const ops = isOps(user);
  if (!ops) {
    if (!sub.task.assignees.some((a) => a.userId === user.id) || !isPublished(sub.task)) return { error: "Esa tarea no es tuya" };
    if (sub.task.status === "TERMINADA") return { error: "La tarea ya fue aceptada: solo puedes consultarla" };
  }
  if (sub.done === done) return { ok: true, taskId: sub.taskId };
  await prisma.$transaction([
    prisma.subtask.update({ where: { id: subtaskId }, data: { done, doneAt: done ? new Date() : null, doneById: done ? user.id : null } }),
    prisma.taskEvent.create({ data: { taskId: sub.taskId, userId: user.id, kind: "SUBTASK", note: `${done ? "✔ Marcó" : "↩ Desmarcó"}: ${sub.title}` } }),
  ]);
  revalidatePath("/tareas");
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
  if (isPublished(task) && (task.publishAt === null || task.publishNotifiedAt !== null)) {
    await notifyUsers(people.map((p) => p.id), { actorId: user.id, kind: "TASK_ASSIGNED", title: `Nueva tarea: ${task.title}`, body: `${task.client.companyName} · ${task.project.projectName} — entrega ${formatMx(task.dueAt)}`, link: `/tareas?tarea=${taskId}` });
    const link = await taskLink(taskId);
    await notify(people.map((p) => p.email), (withLogo) =>
      tareaAsignadaEmail({ title: task.title, clientName: task.client.companyName, projectName: task.project.projectName, due: formatMx(task.dueAt), byName: user.name, link, withLogo }),
    );
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
  if (task.assignees.length <= 1) return { error: "La tarea debe tener al menos una persona asignada" };
  await prisma.$transaction([
    prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } }),
    prisma.subtask.updateMany({ where: { taskId, assigneeId: userId }, data: { assigneeId: null } }),
    prisma.taskEvent.create({ data: { taskId, userId: user.id, kind: "EDITED", note: `Quitó a: ${target.user.name}` } }),
  ]);
  if (isPublished(task) && (task.publishAt === null || task.publishNotifiedAt !== null)) {
    await notifyUsers([userId], { actorId: user.id, kind: "TASK_UNASSIGNED", title: `Ya no tienes asignada la tarea: ${task.title}`, body: `${user.name} te quitó de la tarea`, link: "/tareas" });
  }
  revalidatePath("/tareas");
  return { ok: true, taskId };
}
