import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlace público (sin iniciar sesión) a una evidencia, para los iconos del PDF del reporte.
 * No se guarda nada en la base de datos: la firma es un HMAC del id de la evidencia con AUTH_SECRET, imposible de adivinar
 * y sin caducidad. Si la evidencia se elimina, el enlace deja de funcionar.
 */
const sign = (evidenceId: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`evidencia:${evidenceId}`).digest("base64url").slice(0, 32);

export const evidencePath = (evidenceId: string) => `/api/adjunto/${evidenceId}/${sign(evidenceId)}`;

export function validEvidenceSig(evidenceId: string, sig: string): boolean {
  if (!process.env.AUTH_SECRET) return false;
  const a = Buffer.from(sign(evidenceId));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
