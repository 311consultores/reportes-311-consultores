import { randomUUID } from "node:crypto";
import { deleteObject, putObject } from "@/lib/storage";
import { validateLogo } from "@/lib/branding";

/** Guarda una foto de perfil (PNG o JPG, hasta 2 MB, comprobando el contenido real). Devuelve su clave de almacenamiento. */
export async function storePhoto(file: File): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const v = await validateLogo(file);
  if (!v.ok) return { ok: false, error: v.error.replace("logo", "foto") };
  const key = `perfiles/${randomUUID()}.${v.ext}`;
  await putObject(key, v.buf, v.mime);
  return { ok: true, key };
}

export const removePhoto = (key: string | null | undefined) => (key ? deleteObject(key).catch(() => {}) : Promise.resolve());

// ---------- Cumpleaños: solo día y mes, guardados como "MM-DD" ----------
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function parseBirthday(month: string, day: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!month && !day) return { ok: true, value: null };
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > DAYS_IN_MONTH[m - 1]) {
    return { ok: false, error: "El cumpleaños no es una fecha válida (elige mes y día)" };
  }
  return { ok: true, value: `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}
