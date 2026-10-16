import type { Prisma } from "@prisma/client";
import { addDaysIso, isValidIsoDate, mxDayStart } from "@/lib/finance";

export type Period = "mes" | "7" | "15" | "30" | "rango" | "todo";

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "mes", label: "Mes actual" },
  { value: "7", label: "Últimos 7 días" },
  { value: "15", label: "Últimos 15 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "rango", label: "Personalizado" },
  { value: "todo", label: "Todo el historial" },
];

const isPeriod = (v: string): v is Period => PERIOD_OPTIONS.some((p) => p.value === v);

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** El periodo se toma de la dirección; sin elegir ninguno, el personal interno ve el mes actual y el cliente todo su historial. */
export function parsePeriod(sp: Record<string, string | string[] | undefined>, isClient: boolean) {
  const raw = first(sp.periodo);
  let periodo: Period = isPeriod(raw) ? raw : isClient ? "todo" : "mes";
  let desde = first(sp.desde);
  let hasta = first(sp.hasta);
  if (!isValidIsoDate(desde)) desde = "";
  if (!isValidIsoDate(hasta)) hasta = "";
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];
  if (periodo === "rango" && !desde && !hasta) periodo = "mes"; // personalizado sin fechas: se vuelve al mes actual
  return { periodo, desde, hasta };
}

/**
 * Condición de fecha de creación de los reportes.
 * Mes actual: lo creado este mes MÁS los reportes todavía abiertos (en proceso, terminados, rechazados o aprobados sin enviar)
 * de meses anteriores, para que no se queden olvidados. Cualquier otro periodo muestra solo lo creado dentro de ese periodo.
 */
export function periodWhere(p: { periodo: Period; desde: string; hasta: string }, today: string): Prisma.ReportWhereInput {
  switch (p.periodo) {
    case "todo":
      return {};
    case "mes":
      return {
        OR: [{ createdAt: { gte: mxDayStart(`${today.slice(0, 8)}01`) } }, { status: { in: ["EN_PROCESO", "TERMINADO", "RECHAZADO", "APROBADO"] } }],
      };
    case "rango": {
      const range: Prisma.DateTimeFilter = {};
      if (p.desde) range.gte = mxDayStart(p.desde);
      if (p.hasta) range.lt = mxDayStart(addDaysIso(p.hasta, 1));
      return { createdAt: range };
    }
    default:
      return { createdAt: { gte: mxDayStart(addDaysIso(today, -(Number(p.periodo) - 1))) } };
  }
}

export function periodLabel(p: { periodo: Period; desde: string; hasta: string }): string {
  if (p.periodo === "mes") return "Mes actual, más los reportes abiertos de meses anteriores";
  if (p.periodo === "rango") return `Creados ${p.desde ? `desde ${p.desde}` : ""}${p.desde && p.hasta ? " " : ""}${p.hasta ? `hasta ${p.hasta}` : ""}`;
  if (p.periodo === "todo") return "Todo el historial";
  return `Creados en los últimos ${p.periodo} días`;
}
