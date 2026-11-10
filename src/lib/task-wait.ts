/** Texto «2 días y 4 horas» del plazo de una tarea encadenada (sirve en el navegador y en el servidor). */
export function waitLabel(days: number | null, hours: number | null): string {
  const d = days ?? 0;
  const h = hours ?? 0;
  const parts = [d ? `${d} ${d === 1 ? "día" : "días"}` : "", h ? `${h} ${h === 1 ? "hora" : "horas"}` : ""].filter(Boolean);
  return parts.join(" y ") || "sin plazo";
}
