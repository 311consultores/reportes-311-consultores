import type { TaskStatus } from "@prisma/client";

/** Tarea tal como la recibe el navegador (fechas en ISO). */
export type TaskCard = {
  id: string;
  title: string;
  descriptionHtml: string;
  dueAt: string;
  createdAt: string;
  status: TaskStatus;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  createdByName: string;
  assignees: { id: string; name: string; photoUrl: string | null }[];
  resources: { id: string; title: string; url: string }[];
  events: { id: string; kind: string; note: string | null; userName: string; createdAt: string }[];
  acceptedAt: string | null;
  surprise: boolean;
};
