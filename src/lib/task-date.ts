/** Fecha y hora de ejecución de una actividad, guardada como "AAAA-MM-DD HH:mm" (hora local, sin zona horaria). */
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10-19 14:30" → "19 de octubre de 2026, 14:30 h". Devuelve null si no hay fecha. */
export function formatExecuted(v: string | null | undefined): string | null {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/);
  if (!m) return null;
  return `${Number(m[3])} de ${MONTHS[Number(m[2]) - 1]} de ${m[1]}, ${m[4]} h`;
}
