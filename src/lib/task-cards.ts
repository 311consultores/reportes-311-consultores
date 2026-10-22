import type { Prisma } from "@prisma/client";
import type { TaskCard } from "@/app/(app)/tareas/task-types";

/** Todo lo que se necesita de la base de datos para armar una tarjeta de tarea. */
export const taskInclude = {
  client: { select: { companyName: true } },
  project: { select: { projectName: true } },
  area: { select: { id: true, name: true, color: true } },
  createdBy: { select: { id: true, name: true, photoUrl: true } },
  assignees: { include: { user: { select: { id: true, name: true, photoUrl: true, phone: true } } } },
  resources: { orderBy: { position: "asc" } },
  events: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
  subtasks: { orderBy: { position: "asc" }, include: { assignee: { select: { name: true } }, doneBy: { select: { name: true } } } },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

/** Convierte una tarea de la base de datos en lo que recibe el navegador (fechas en ISO). */
export function toCard(t: TaskRow): TaskCard {
  const accepted = t.events.find((e) => e.kind === "ACCEPTED"); // los eventos vienen del más reciente al más antiguo
  return {
    id: t.id,
    title: t.title,
    descriptionHtml: t.descriptionHtml,
    dueAt: t.dueAt.toISOString(),
    publishAt: t.publishAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    status: t.status,
    clientId: t.clientId,
    clientName: t.client.companyName,
    projectId: t.projectId,
    projectName: t.project.projectName,
    areaId: t.area?.id ?? null,
    areaName: t.area?.name ?? null,
    areaColor: t.area?.color ?? null,
    createdByName: t.createdBy.name,
    createdBy: { id: t.createdBy.id, name: t.createdBy.name, photoUrl: t.createdBy.photoUrl },
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name, photoUrl: a.user.photoUrl, phone: a.user.phone })),
    resources: t.resources.map((r) => ({ id: r.id, title: r.title, url: r.url })),
    events: t.events.map((e) => ({ id: e.id, kind: e.kind, note: e.note, userName: e.user.name, createdAt: e.createdAt.toISOString() })),
    subtasks: t.subtasks.map((s) => ({
      id: s.id, title: s.title, assigneeId: s.assigneeId, assigneeName: s.assignee?.name ?? null, dueAt: s.dueAt?.toISOString() ?? null,
      done: s.done, doneAt: s.doneAt?.toISOString() ?? null, doneByName: s.doneBy?.name ?? null,
    })),
    acceptedAt: t.acceptedAt?.toISOString() ?? null,
    surprise: t.surprise,
    surpriseOpened: !!t.surpriseOpenedAt,
    acceptNote: accepted?.note ?? null,
    acceptedBy: accepted?.user.name ?? null,
  };
}
