"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { centsToDecimal, dateOnly, decimalToCents, formatCents, parseMoney, todayMx } from "@/lib/finance";
import { balanceOf, boxLabel, CASH_LABEL, getBalances, writeEntries } from "@/lib/ledger";
import { parseBreakdown } from "@/lib/payroll";

type Res = { error?: string; ok?: boolean };

const refresh = () => {
  revalidatePath("/finanzas/nomina");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/gastos");
};

/** Monto con signo («-250» o «500») en centavos; vacío = 0. */
function parseSigned(text: string): number | null {
  const t = text.trim();
  if (!t) return 0;
  const neg = t.startsWith("-");
  const v = parseMoney(neg ? t.slice(1) : t.replace(/^\+/, ""));
  return v === null ? null : neg ? -v : v;
}

/**
 * Registra el pago de la nómina de una semana: sale de la caja NÓMINA (efectivo y/o banco) como una sola salida.
 * Se puede ajustar el total de ese pago (bono o descuento) sin cambiar los sueldos fijos. Queda congelado el desglose.
 */
export async function payPayrollWeek(id: string, input: { cash: string; bank: string; adjustment: string; note: string }): Promise<Res> {
  const admin = await requireUser(["ADMIN"]);
  const adj = parseSigned(input.adjustment);
  if (adj === null) return { error: "El ajuste debe ser un monto (por ejemplo 500 o -250)" };
  const note = input.note.trim().slice(0, 300);
  if (adj !== 0 && note.length < 3) return { error: "Escribe el motivo del ajuste" };
  const cash = input.cash.trim() ? parseMoney(input.cash) : 0;
  const bank = input.bank.trim() ? parseMoney(input.bank) : 0;
  if (cash === null || bank === null) return { error: "Los montos deben ser mayores a cero (por ejemplo 4500.00)" };
  try {
    await prisma.$transaction(async (tx) => {
      const w = await tx.payrollWeek.findUnique({ where: { id } });
      if (!w || w.status !== "PROGRAMADA") throw new Error("Esta semana ya está pagada");
      const base = decimalToCents(w.baseTotal);
      const total = base + adj;
      if (total <= 0) throw new Error("El total a pagar debe ser mayor a cero (revisa los sueldos y el ajuste)");
      if (cash + bank !== total) throw new Error(`Efectivo (${formatCents(cash)}) + banco (${formatCents(bank)}) debe sumar ${formatCents(total)}`);
      const balances = await getBalances(tx);
      for (const [type, cents] of [["EFECTIVO", cash], ["BANCO", bank]] as const) {
        if (cents > 0 && balanceOf(balances, "NOMINA", type) < cents) {
          throw new Error(`La caja ${boxLabel("NOMINA")} solo tiene ${formatCents(balanceOf(balances, "NOMINA", type))} en ${CASH_LABEL[type].toLowerCase()} y se necesitan ${formatCents(cents)}.`);
        }
      }
      const on = dateOnly(todayMx());
      const concept = `Nómina semana ${w.week} de ${w.year}`;
      const e = await tx.expense.create({
        data: { concept, kind: "NOMINA", cashAmount: centsToDecimal(cash), bankAmount: centsToDecimal(bank), total: centsToDecimal(total), occurredOn: on, createdById: admin.id },
      });
      await writeEntries(tx, [
        ...(cash > 0 ? [{ box: "NOMINA" as const, cashType: "EFECTIVO" as const, cents: -cash, kind: "GASTO" as const, occurredOn: on, createdById: admin.id, expenseId: e.id, note: concept }] : []),
        ...(bank > 0 ? [{ box: "NOMINA" as const, cashType: "BANCO" as const, cents: -bank, kind: "GASTO" as const, occurredOn: on, createdById: admin.id, expenseId: e.id, note: concept }] : []),
      ]);
      await tx.payrollWeek.update({
        where: { id },
        data: { status: "PAGADA", paidTotal: centsToDecimal(total), adjustment: centsToDecimal(adj), adjustmentNote: adj !== 0 ? note : null, expenseId: e.id, paidAt: new Date(), paidById: admin.id },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el pago" };
  }
  refresh();
  return { ok: true };
}

/** Anula un pago de nómina (con motivo): el dinero vuelve a la caja NÓMINA y la semana regresa a PROGRAMADA. */
export async function voidPayrollWeek(id: string, reason: string): Promise<Res> {
  const admin = await requireUser(["ADMIN"]);
  const why = reason.trim();
  if (why.length < 3) return { error: "Escribe el motivo" };
  try {
    await prisma.$transaction(async (tx) => {
      const w = await tx.payrollWeek.findUnique({ where: { id } });
      if (!w || w.status !== "PAGADA" || !w.expenseId) throw new Error("Esta semana no está pagada");
      const e = await tx.expense.findUnique({ where: { id: w.expenseId } });
      if (e && !e.voidedAt) {
        const cash = decimalToCents(e.cashAmount);
        const bank = decimalToCents(e.bankAmount);
        const today = dateOnly(todayMx());
        await writeEntries(tx, [
          ...(cash > 0 ? [{ box: "NOMINA" as const, cashType: "EFECTIVO" as const, cents: cash, kind: "ANULA_GASTO" as const, occurredOn: today, createdById: admin.id, expenseId: e.id, note: `Anulado: ${e.concept}` }] : []),
          ...(bank > 0 ? [{ box: "NOMINA" as const, cashType: "BANCO" as const, cents: bank, kind: "ANULA_GASTO" as const, occurredOn: today, createdById: admin.id, expenseId: e.id, note: `Anulado: ${e.concept}` }] : []),
        ]);
        await tx.expense.update({ where: { id: e.id }, data: { voidedAt: new Date(), voidReason: why.slice(0, 300), voidedById: admin.id } });
      }
      await tx.payrollWeek.update({ where: { id }, data: { status: "PROGRAMADA", paidTotal: null, adjustment: 0, adjustmentNote: null, expenseId: null, paidAt: null, paidById: null, voidReason: why.slice(0, 300), reminderSentAt: null } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo anular" };
  }
  refresh();
  return { ok: true };
}

/** Guarda los sueldos semanales de la configuración de nómina (uno por persona; vacío = no cobra nómina). */
export async function savePayConfig(rows: { userId: string; amount: string }[]): Promise<Res> {
  await requireUser(["ADMIN"]);
  const parsed: { userId: string; cents: number | null }[] = [];
  for (const r of rows) {
    if (!/^[0-9a-f-]{36}$/i.test(r.userId)) continue;
    const t = r.amount.trim();
    if (!t) { parsed.push({ userId: r.userId, cents: null }); continue; }
    const c = parseMoney(t);
    if (c === null) return { error: `Monto no válido: «${t}»` };
    parsed.push({ userId: r.userId, cents: c });
  }
  await prisma.$transaction(parsed.map((p) => prisma.user.update({ where: { id: p.userId }, data: { weeklyPay: p.cents === null ? null : centsToDecimal(p.cents) } })));
  refresh();
  revalidatePath("/usuarios");
  return { ok: true };
}
