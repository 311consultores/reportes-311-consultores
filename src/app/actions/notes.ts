"use server";

import { revalidatePath } from "next/cache";
import { STAFF_ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { notifyUsers } from "@/lib/notifications";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { parseMxInput } from "@/lib/tasks-shared";
import { NOTE_COLORS } from "@/lib/note-types";

type Result = { ok?: boolean; error?: string; id?: string };

const staff = () => requireUser(STAFF_ROLES);
const colorOk = (c: string) => NOTE_COLORS.some((x) => x.id === c);

/**
 * La nota si esta persona puede verla. Las notas son PRIVADAS: solo las ve su dueño y las personas con quienes se compartió
 * (ni siquiera el Administrador puede ver las ajenas).
 */
async function access(user: CurrentUser, id: string) {
  const n = await prisma.note.findFirst({
    where: { id, OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id } } }] },
    include: { shares: true },
  });
  if (!n) return null;
  const mine = n.ownerId === user.id;
  return { note: n, mine, canEdit: mine || !!n.shares.find((s) => s.userId === user.id)?.canEdit };
}

export type NoteInput = { kind: "TEXT" | "CHECKLIST"; title: string; bodyHtml: string; items: { text: string; done: boolean }[]; color: string; labelIds?: string[] };

const cleanItems = (items: { text: string; done: boolean }[]) =>
  items.map((i) => ({ text: i.text.trim().slice(0, 500), done: !!i.done })).filter((i) => i.text).slice(0, 200);

/** Crea una nota nueva (arriba de las demás). */
export async function createNote(input: NoteInput): Promise<Result> {
  const user = await staff();
  const first = await prisma.note.findFirst({ where: { ownerId: user.id }, orderBy: { position: "asc" }, select: { position: true } });
  const labelIds = input.labelIds?.length ? (await prisma.noteLabel.findMany({ where: { id: { in: input.labelIds }, ownerId: user.id }, select: { id: true } })).map((l) => l.id) : [];
  const items = input.kind === "CHECKLIST" ? cleanItems(input.items) : [];
  const note = await prisma.note.create({
    data: {
      ownerId: user.id,
      kind: input.kind,
      title: input.title.trim().slice(0, 191),
      bodyHtml: input.kind === "TEXT" ? sanitizeRichHtml(input.bodyHtml) : "",
      color: colorOk(input.color) ? input.color : "white",
      position: (first?.position ?? 0) - 1,
      items: { create: items.map((i, position) => ({ ...i, position })) },
      labels: { create: labelIds.map((labelId) => ({ labelId })) },
    },
  });
  revalidatePath("/baul");
  return { ok: true, id: note.id };
}

export type NotePatch = {
  title?: string;
  bodyHtml?: string;
  kind?: "TEXT" | "CHECKLIST";
  items?: { text: string; done: boolean }[];
  color?: string;
  /** Fecha y hora de recordatorio (hora de México, «AAAA-MM-DDTHH:mm») o null para quitarlo. */
  reminder?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
};

/** Guarda cambios de una nota (autoguardado). Quien puede editar cambia el contenido; solo el dueño cambia color, recordatorio y vínculos. La última guardada gana. */
export async function updateNote(id: string, patch: NotePatch): Promise<Result> {
  const user = await staff();
  const a = await access(user, id);
  if (!a || a.note.trashedAt) return { error: "La nota no existe" };
  if (!a.canEdit) return { error: "Solo puedes ver esta nota" };

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title.trim().slice(0, 191);
  if (patch.bodyHtml !== undefined) data.bodyHtml = sanitizeRichHtml(patch.bodyHtml);
  if (patch.kind) data.kind = patch.kind;
  if (a.mine) {
    if (patch.color !== undefined && colorOk(patch.color)) data.color = patch.color;
    if (patch.reminder !== undefined) {
      if (patch.reminder === null) { data.reminderAt = null; data.reminderSentAt = null; }
      else {
        const d = parseMxInput(patch.reminder);
        if (!d) return { error: "La fecha del recordatorio no es válida" };
        data.reminderAt = d;
        data.reminderSentAt = null;
      }
    }
    if (patch.projectId !== undefined || patch.clientId !== undefined || patch.taskId !== undefined) {
      let clientId = patch.clientId ?? null;
      let projectId = patch.projectId ?? null;
      if (projectId) {
        const p = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
        if (!p) projectId = null;
        else clientId = p.clientId; // el proyecto manda sobre el cliente
      }
      const taskId = patch.taskId && (await prisma.task.findUnique({ where: { id: patch.taskId }, select: { id: true } })) ? patch.taskId : null;
      Object.assign(data, { clientId, projectId, taskId });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.note.update({ where: { id }, data });
    if (patch.items) {
      const items = cleanItems(patch.items);
      await tx.noteItem.deleteMany({ where: { noteId: id } });
      if (items.length) await tx.noteItem.createMany({ data: items.map((i, position) => ({ ...i, noteId: id, position })) });
    }
  });
  revalidatePath("/baul");
  return { ok: true };
}

async function ownerOnly(id: string) {
  const user = await staff();
  const a = await access(user, id);
  return a && a.mine ? { user, note: a.note } : null;
}

/** Fijar / archivar (solo el dueño). */
export async function setNoteFlags(id: string, flags: { pinned?: boolean; archived?: boolean }): Promise<Result> {
  const o = await ownerOnly(id);
  if (!o) return { error: "La nota no existe" };
  await prisma.note.update({
    where: { id },
    data: { ...(flags.pinned !== undefined ? { pinned: flags.pinned } : {}), ...(flags.archived !== undefined ? { archivedAt: flags.archived ? new Date() : null, ...(flags.archived ? { pinned: false } : {}) } : {}) },
  });
  revalidatePath("/baul");
  return { ok: true };
}

/** A la papelera (se borra definitivamente a los 30 días). */
export async function trashNote(id: string): Promise<Result> {
  const o = await ownerOnly(id);
  if (!o) return { error: "La nota no existe" };
  await prisma.note.update({ where: { id }, data: { trashedAt: new Date(), pinned: false } });
  revalidatePath("/baul");
  return { ok: true };
}

export async function restoreNote(id: string): Promise<Result> {
  const o = await ownerOnly(id);
  if (!o) return { error: "La nota no existe" };
  await prisma.note.update({ where: { id }, data: { trashedAt: null } });
  revalidatePath("/baul");
  return { ok: true };
}

/** Borra definitivamente una nota que ya está en la papelera. */
export async function deleteNoteForever(id: string): Promise<Result> {
  const o = await ownerOnly(id);
  if (!o || !o.note.trashedAt) return { error: "La nota no está en la papelera" };
  await prisma.note.delete({ where: { id } });
  revalidatePath("/baul");
  return { ok: true };
}

export async function emptyTrash(): Promise<Result> {
  const user = await staff();
  await prisma.note.deleteMany({ where: { ownerId: user.id, trashedAt: { not: null } } });
  revalidatePath("/baul");
  return { ok: true };
}

/** Guarda el orden de las notas propias (arrastrar y soltar). */
export async function reorderNotes(ids: string[]): Promise<Result> {
  const user = await staff();
  const mine = new Set((await prisma.note.findMany({ where: { id: { in: ids }, ownerId: user.id }, select: { id: true } })).map((n) => n.id));
  await prisma.$transaction(ids.filter((i) => mine.has(i)).map((id, position) => prisma.note.update({ where: { id }, data: { position } })));
  return { ok: true };
}

/** Etiquetas (propias de cada persona). */
export async function createLabel(name: string): Promise<Result> {
  const user = await staff();
  const n = name.trim().slice(0, 60);
  if (!n) return { error: "Escribe el nombre de la etiqueta" };
  const exists = await prisma.noteLabel.findFirst({ where: { ownerId: user.id, name: n } });
  if (exists) return { ok: true, id: exists.id };
  const l = await prisma.noteLabel.create({ data: { ownerId: user.id, name: n } });
  revalidatePath("/baul");
  return { ok: true, id: l.id };
}

export async function deleteLabel(id: string): Promise<Result> {
  const user = await staff();
  await prisma.noteLabel.deleteMany({ where: { id, ownerId: user.id } });
  revalidatePath("/baul");
  return { ok: true };
}

export async function setNoteLabels(id: string, labelIds: string[]): Promise<Result> {
  const o = await ownerOnly(id);
  if (!o) return { error: "La nota no existe" };
  const valid = (await prisma.noteLabel.findMany({ where: { id: { in: labelIds }, ownerId: o.user.id }, select: { id: true } })).map((l) => l.id);
  await prisma.$transaction([
    prisma.noteLabelLink.deleteMany({ where: { noteId: id } }),
    prisma.noteLabelLink.createMany({ data: valid.map((labelId) => ({ noteId: id, labelId })) }),
  ]);
  revalidatePath("/baul");
  return { ok: true };
}

/** Comparte la nota con personas concretas del personal (solo el dueño). Avisa a quienes se agregan. */
export async function shareNote(id: string, shares: { userId: string; canEdit: boolean }[]): Promise<Result> {
  const o = await ownerOnly(id);
  if (!o) return { error: "Solo el dueño puede compartir la nota" };
  const targets = await prisma.user.findMany({
    where: { id: { in: shares.map((s) => s.userId).filter((u) => u !== o.user.id) }, active: true, role: { in: STAFF_ROLES } },
    select: { id: true },
  });
  const valid = new Map(shares.map((s) => [s.userId, s.canEdit]));
  const before = new Set((await prisma.noteShare.findMany({ where: { noteId: id } })).map((s) => s.userId));
  await prisma.$transaction([
    prisma.noteShare.deleteMany({ where: { noteId: id } }),
    prisma.noteShare.createMany({ data: targets.map((t) => ({ noteId: id, userId: t.id, canEdit: !!valid.get(t.id) })) }),
  ]);
  const added = targets.map((t) => t.id).filter((u) => !before.has(u));
  if (added.length) {
    await notifyUsers(added, { actorId: o.user.id, kind: "NOTE_SHARED", title: `${o.user.name} compartió una nota contigo`, body: o.note.title || "Nota sin título", link: `/baul?nota=${id}` });
  }
  revalidatePath("/baul");
  return { ok: true };
}

/** Deja de ver una nota que alguien compartió contigo. */
export async function leaveNote(id: string): Promise<Result> {
  const user = await staff();
  await prisma.noteShare.deleteMany({ where: { noteId: id, userId: user.id } });
  revalidatePath("/baul");
  return { ok: true };
}
