import type { Prisma } from "@prisma/client";
import type { NoteCard } from "@/lib/note-types";

/** Lo necesario para armar una nota. */
export const noteInclude = {
  owner: { select: { id: true, name: true, photoUrl: true } },
  items: { orderBy: { position: "asc" } },
  labels: { select: { labelId: true } },
  shares: { include: { user: { select: { id: true, name: true, photoUrl: true } } } },
  client: { select: { companyName: true } },
  project: { select: { projectName: true } },
  task: { select: { title: true } },
} satisfies Prisma.NoteInclude;

export type NoteRow = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

/** Convierte una nota de la base de datos en lo que recibe el navegador, desde el punto de vista de `meId`. */
export function toNoteCard(n: NoteRow, meId: string): NoteCard {
  const mine = n.ownerId === meId;
  const share = n.shares.find((s) => s.userId === meId);
  return {
    id: n.id,
    mine,
    canEdit: mine || !!share?.canEdit,
    ownerId: n.owner.id,
    ownerName: n.owner.name,
    ownerPhoto: n.owner.photoUrl,
    kind: n.kind === "CHECKLIST" ? "CHECKLIST" : "TEXT",
    title: n.title,
    bodyHtml: n.bodyHtml,
    items: n.items.map((i) => ({ id: i.id, text: i.text, done: i.done })),
    color: n.color,
    pinned: n.pinned,
    position: n.position,
    archived: !!n.archivedAt,
    trashedAt: n.trashedAt?.toISOString() ?? null,
    reminderAt: mine ? (n.reminderAt?.toISOString() ?? null) : null, // el recordatorio es personal del dueño
    labelIds: mine ? n.labels.map((l) => l.labelId) : [], // las etiquetas son de cada persona
    shares: mine ? n.shares.map((s) => ({ userId: s.user.id, name: s.user.name, photoUrl: s.user.photoUrl, canEdit: s.canEdit })) : [],
    link: { clientId: n.clientId, clientName: n.client?.companyName ?? null, projectId: n.projectId, projectName: n.project?.projectName ?? null, taskId: n.taskId, taskTitle: n.task?.title ?? null },
    updatedAt: n.updatedAt.toISOString(),
  };
}
