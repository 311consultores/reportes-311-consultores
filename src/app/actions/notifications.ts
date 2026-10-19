"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type NotificationItem = { id: string; kind: string; title: string; body: string | null; link: string; createdAt: string; read: boolean };

/** Últimos avisos de la persona y cuántos están sin leer. */
export async function getNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const user = await requireUser();
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items: rows.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, createdAt: n.createdAt.toISOString(), read: !!n.readAt })), unread };
}

export async function unreadCount(): Promise<number> {
  const user = await requireUser();
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}

export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
}
