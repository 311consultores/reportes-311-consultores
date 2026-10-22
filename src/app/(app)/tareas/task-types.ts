import type { TaskStatus } from "@prisma/client";

/** Datos para precargar «Nueva tarea» (por ejemplo, al convertir una nota del Baúl en tarea). */
export type TaskPrefill = { title: string; descriptionHtml: string; clientId: string; projectId: string; subtasks: string[] };

/** Área disponible para elegir o filtrar. */
export type AreaOption = { id: string; name: string; color: string; active: boolean };

/** Tarea tal como la recibe el navegador (fechas en ISO). */
export type TaskCard = {
  id: string;
  title: string;
  descriptionHtml: string;
  dueAt: string;
  publishAt: string | null; // tarea programada: aparece para la persona asignada a partir de esta fecha
  createdAt: string;
  status: TaskStatus;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  areaId: string | null;
  areaName: string | null;
  areaColor: string | null;
  createdByName: string;
  createdBy: { id: string; name: string; photoUrl: string | null };
  assignees: { id: string; name: string; photoUrl: string | null; phone: string | null }[];
  resources: { id: string; title: string; url: string }[];
  events: { id: string; kind: string; note: string | null; userName: string; createdAt: string }[];
  subtasks: { id: string; title: string; assigneeId: string | null; assigneeName: string | null; dueAt: string | null; done: boolean; doneAt: string | null; doneByName: string | null }[];
  acceptedAt: string | null;
  surprise: boolean;
  surpriseOpened: boolean;
  acceptNote: string | null;
  acceptedBy: string | null;
};
