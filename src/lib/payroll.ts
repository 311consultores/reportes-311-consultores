import { prisma } from "@/lib/prisma";
import { addDaysIso, centsToDecimal, dateOnly, decimalToCents, isoDate, todayMx } from "@/lib/finance";

/** Primer pago de nómina del sistema: sábado 7 de noviembre de 2026 (semana 45). Las semanas anteriores no se crean. */
export const FIRST_PAY_DATE = "2026-11-07";

export type BreakdownRow = { userId: string; name: string; cents: number };

/** Semana ISO (lunes a domingo) de una fecha AAAA-MM-DD. */
export function isoWeekOf(iso: string): { year: number; week: number } {
  const d = dateOnly(iso);
  const day = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // el jueves de esa semana decide el año
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { year, week };
}

/** Primer sábado igual o posterior a la fecha. */
export function saturdayOnOrAfter(iso: string): string {
  const dow = dateOnly(iso).getUTCDay(); // 0 domingo … 6 sábado
  return addDaysIso(iso, (6 - dow + 7) % 7);
}

/** Sueldos semanales vigentes de las personas activas (los que tienen monto mayor a cero). */
export async function currentPayConfig(): Promise<BreakdownRow[]> {
  const users = await prisma.user.findMany({ where: { active: true, weeklyPay: { gt: 0 }, role: { not: "CLIENTE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, weeklyPay: true } });
  return users.map((u) => ({ userId: u.id, name: u.name, cents: decimalToCents(u.weeklyPay ?? 0) }));
}

export const parseBreakdown = (raw: string): BreakdownRow[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((r) => r && typeof r.cents === "number") : [];
  } catch {
    return [];
  }
};

/**
 * Crea las semanas que faltan (cada sábado desde el 7/nov/2026 hasta el próximo sábado) y mantiene al día el desglose de las que siguen
 * PROGRAMADAS con los sueldos vigentes. El desglose de una semana PAGADA, o editada a mano, no se vuelve a tocar.
 */
export async function ensurePayrollWeeks(): Promise<void> {
  const cfg = await currentPayConfig();
  const base = cfg.reduce((s, r) => s + r.cents, 0);
  const last = saturdayOnOrAfter(todayMx());
  const existing = await prisma.payrollWeek.findMany({ select: { id: true, year: true, week: true, status: true, edited: true } });
  const have = new Map(existing.map((w) => [`${w.year}-${w.week}`, w]));
  for (let pay = FIRST_PAY_DATE; pay <= last; pay = addDaysIso(pay, 7)) {
    const { year, week } = isoWeekOf(pay);
    const w = have.get(`${year}-${week}`);
    const data = { baseTotal: centsToDecimal(base), breakdown: JSON.stringify(cfg) };
    if (!w) await prisma.payrollWeek.create({ data: { year, week, payDate: dateOnly(pay), ...data } }).catch(() => null); // si otra visita la creó a la vez, se ignora
    else if (w.status === "PROGRAMADA" && !w.edited) await prisma.payrollWeek.update({ where: { id: w.id }, data });
  }
}
