import { prisma } from "@/lib/prisma";

/** Crea avisos dentro del portal (la campanita) para estas personas. */
export async function notifyUsers(userIds: string[], n: { kind: string; title: string; body?: string | null; link: string; actorId?: string | null }) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, kind: n.kind, title: n.title.slice(0, 191), body: n.body ? n.body.slice(0, 500) : null, link: n.link.slice(0, 300), actorId: n.actorId ?? null })),
  });
}

/** Administradores y editores activos (quienes revisan las tareas). */
export async function opsUserIds(): Promise<string[]> {
  return (await prisma.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR"] }, active: true }, select: { id: true } })).map((u) => u.id);
}
