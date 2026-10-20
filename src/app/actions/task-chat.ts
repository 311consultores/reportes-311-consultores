"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { readLogo311 } from "@/lib/branding";
import { getBaseUrl } from "@/lib/base-url";
import { tareaMensajeEmail } from "@/lib/email-templates";
import { notifyUsers, opsUserIds } from "@/lib/notifications";
import { htmlToText, sanitizeRichHtml } from "@/lib/sanitize";

export type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  photoUrl: string | null;
  bodyHtml: string;
  gifUrl: string | null;
  createdAt: string;
  attachments: { id: string; key: string; type: string; name: string; size: number }[];
};

const isOps = (u: CurrentUser) => u.role === "ADMIN" || u.role === "EDITOR";

/** La tarea, si esta persona puede participar: Admin y Editor, o el TEAM 311 asignado. */
async function taskFor(user: CurrentUser, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: { select: { userId: true, user: { select: { email: true } } } } } });
  if (!task) return null;
  if (!isOps(user) && !task.assignees.some((a) => a.userId === user.id)) return null;
  return task;
}

const reviewNotifyEmails = () =>
  (process.env.TEAM_NOTIFY_EMAILS ?? "admon@311consultores.com,necesito@311consultores.com").split(/[,;\s]+/).filter(Boolean);

export async function getTaskMessages(taskId: string): Promise<ChatMessage[]> {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  if (!(await taskFor(user, taskId))) return [];
  const rows = await prisma.taskMessage.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, photoUrl: true } }, attachments: { orderBy: { createdAt: "asc" } } },
  });
  return rows.map((m) => ({
    id: m.id, userId: m.userId, userName: m.user.name, photoUrl: m.user.photoUrl, bodyHtml: m.bodyHtml, gifUrl: m.gifUrl, createdAt: m.createdAt.toISOString(),
    attachments: m.attachments.map((a) => ({ id: a.id, key: a.key, type: a.type, name: a.name, size: a.size })),
  }));
}

/**
 * Envía un mensaje al chat de la tarea (texto con formato, GIF y/o adjuntos ya subidos).
 * Avisa a la otra parte dentro del portal y por correo (el correo se agrupa: máximo uno cada 5 minutos por persona y tarea).
 */
export async function sendTaskMessage(input: { taskId: string; bodyHtml: string; gifUrl?: string | null; attachmentIds?: string[] }): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const task = await taskFor(user, input.taskId);
  if (!task) return { error: "La tarea no existe" };

  const body = sanitizeRichHtml(input.bodyHtml ?? "");
  const gifUrl = input.gifUrl && /^https:\/\/([\w-]+\.)*giphy\.com\/[^\s]+$/i.test(input.gifUrl) ? input.gifUrl.slice(0, 1000) : null;
  const attIds = [...new Set(input.attachmentIds ?? [])];
  const atts = attIds.length ? await prisma.taskAttachment.findMany({ where: { id: { in: attIds }, taskId: task.id, uploadedById: user.id, messageId: null } }) : [];
  const text = htmlToText(body);
  if (!text && !gifUrl && atts.length === 0) return { error: "Escribe un mensaje, o agrega un GIF o un archivo" };

  const recent = await prisma.taskMessage.findFirst({ where: { taskId: task.id, userId: user.id, createdAt: { gt: new Date(Date.now() - 5 * 60_000) } }, select: { id: true } });
  const msg = await prisma.taskMessage.create({ data: { taskId: task.id, userId: user.id, bodyHtml: body, gifUrl } });
  if (atts.length) await prisma.taskAttachment.updateMany({ where: { id: { in: atts.map((a) => a.id) } }, data: { messageId: msg.id } });

  // Avisos a la otra parte
  const link = `/tareas?tarea=${task.id}`;
  const snippet = text ? text.slice(0, 280) : gifUrl ? "Envió un GIF" : `Envió ${atts.length} archivo(s)`;
  const toUsers = isOps(user) ? task.assignees.map((a) => a.userId) : await opsUserIds();
  await notifyUsers(toUsers.filter((id) => id !== user.id), { actorId: user.id, kind: "TASK_MESSAGE", title: `${user.name} escribió en «${task.title}»`, body: snippet, link });
  if (!recent) {
    try {
      const logo = await readLogo311();
      const to = isOps(user) ? task.assignees.map((a) => a.user.email) : reviewNotifyEmails();
      if (to.length) {
        await sendMail({
          to,
          ...tareaMensajeEmail({ title: task.title, byName: user.name, snippet, link: `${await getBaseUrl()}${link}`, withLogo: !!logo }),
          inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined,
        });
      }
    } catch (e) {
      console.error("[chat de tarea] no se pudo enviar el correo:", e);
    }
  }
  return { ok: true };
}
