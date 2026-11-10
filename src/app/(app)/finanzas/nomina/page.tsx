import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { decimalToCents, isoDate, todayMx } from "@/lib/finance";
import { ensurePayrollWeeks, parseBreakdown } from "@/lib/payroll";
import { FinanzasTabs } from "../tabs";
import { PayrollClient, type PayConfigRow, type PayWeekRow } from "./payroll-client";
import { getBalances } from "@/lib/ledger";

export const metadata = { title: "Nómina | Portal de Operaciones" };

export default async function PayrollPage() {
  await requireUser(["ADMIN"]);
  await ensurePayrollWeeks();
  const [weeks, people, balances] = await Promise.all([
    prisma.payrollWeek.findMany({ orderBy: [{ year: "desc" }, { week: "desc" }], take: 120 }),
    prisma.user.findMany({ where: { active: true, role: { not: "CLIENTE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, weeklyPay: true } }),
    getBalances(),
  ]);

  const rows: PayWeekRow[] = weeks.map((w) => ({
    id: w.id, year: w.year, week: w.week, payDate: isoDate(w.payDate), status: w.status as "PROGRAMADA" | "PAGADA",
    baseCents: decimalToCents(w.baseTotal), breakdown: parseBreakdown(w.breakdown),
    adjustmentCents: decimalToCents(w.adjustment), adjustmentNote: w.adjustmentNote, paidCents: w.paidTotal ? decimalToCents(w.paidTotal) : null,
    paidAt: w.paidAt?.toISOString() ?? null, voidReason: w.voidReason,
  }));
  const config: PayConfigRow[] = people.map((p) => ({ userId: p.id, name: p.name, amount: p.weeklyPay ? p.weeklyPay.toString() : "" }));

  return (
    <div className="space-y-6">
      <h1 className="page-title">Finanzas</h1>
      <FinanzasTabs active="/finanzas/nomina" />
      <PayrollClient rows={rows} config={config} today={todayMx()} balances={Object.fromEntries(balances)} />
    </div>
  );
}
