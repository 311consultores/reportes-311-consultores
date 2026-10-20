"use server";

import { STAFF_ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hashEndpoint, publicVapidKey, pushConfigured, sendPush } from "@/lib/push";

type Result = { ok?: boolean; error?: string };

async function staff() {
  return requireUser(STAFF_ROLES); // el Cliente no recibe notificaciones del navegador
}

/** ¿El servidor tiene claves para enviar notificaciones? y la clave pública que usa el navegador. */
export async function getPushInfo(): Promise<{ configured: boolean; publicKey: string }> {
  await staff();
  return { configured: pushConfigured(), publicKey: publicVapidKey() };
}

/** Guarda (o actualiza) este dispositivo como suscrito a las notificaciones del navegador. */
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string): Promise<Result> {
  const user = await staff();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Suscripción no válida" };
  const endpointHash = hashEndpoint(sub.endpoint);
  // Si otra persona usaba este mismo dispositivo, la suscripción pasa a la persona que acaba de entrar
  await prisma.pushSubscription.upsert({
    where: { endpointHash },
    create: { userId: user.id, endpointHash, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 255) },
    update: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 255) },
  });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const user = await staff();
  await prisma.pushSubscription.deleteMany({ where: { endpointHash: hashEndpoint(endpoint), userId: user.id } });
  return { ok: true };
}

/** Tipos de aviso que este dispositivo tiene apagados. */
export async function getPushMuted(endpoint: string): Promise<string[]> {
  const user = await staff();
  const s = await prisma.pushSubscription.findFirst({ where: { endpointHash: hashEndpoint(endpoint), userId: user.id }, select: { mutedKinds: true } });
  try {
    return s?.mutedKinds ? (JSON.parse(s.mutedKinds) as string[]) : [];
  } catch {
    return [];
  }
}

export async function setPushMuted(endpoint: string, muted: string[]): Promise<Result> {
  const user = await staff();
  const clean = [...new Set(muted.filter((k) => /^[A-Z_]{3,30}$/.test(k)))];
  await prisma.pushSubscription.updateMany({ where: { endpointHash: hashEndpoint(endpoint), userId: user.id }, data: { mutedKinds: clean.length ? JSON.stringify(clean) : null } });
  return { ok: true };
}

/** Envía una notificación de prueba a los dispositivos de la persona. */
export async function sendTestPush(): Promise<Result> {
  const user = await staff();
  if (!pushConfigured()) return { error: "Las notificaciones del navegador todavía no están configuradas en el servidor." };
  const n = await prisma.pushSubscription.count({ where: { userId: user.id } });
  if (n === 0) return { error: "Este dispositivo todavía no tiene las notificaciones activadas." };
  await sendPush([user.id], { kind: "PRUEBA", title: "🔔 Notificación de prueba", body: "¡Listo! Las notificaciones del Portal 311 funcionan en este dispositivo.", url: "/aplicacion" });
  return { ok: true };
}
