import { createHash } from "node:crypto";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let ready: boolean | null = null;

/** Configura web-push con las claves VAPID del servidor; false si no están configuradas. */
function configure(): boolean {
  if (ready !== null) return ready;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) return (ready = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "mailto:admon@311consultores.com", pub, priv);
  return (ready = true);
}

export const pushConfigured = () => configure();
export const publicVapidKey = () => process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
export const hashEndpoint = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

export type PushPayload = { kind: string; title: string; body?: string | null; url: string };

/**
 * Envía una notificación del navegador a todos los dispositivos de estas personas (salvo los que apagaron ese tipo de aviso).
 * Nunca lanza errores: si un envío falla, el aviso ya quedó en la campanita. Los dispositivos dados de baja se limpian solos.
 */
export async function sendPush(userIds: string[], p: PushPayload): Promise<void> {
  try {
    if (!configure() || userIds.length === 0) return;
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: [...new Set(userIds)] } } });
    const body = JSON.stringify({ title: p.title, body: p.body ?? "", url: p.url, tag: p.kind });
    await Promise.all(
      subs.map(async (s) => {
        try {
          if (s.mutedKinds && (JSON.parse(s.mutedKinds) as string[]).includes(p.kind)) return;
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          else console.error("[push] no se pudo enviar:", code ?? e);
        }
      }),
    );
  } catch (e) {
    console.error("[push] error:", e);
  }
}
