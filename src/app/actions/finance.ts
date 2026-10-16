"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Box, CashType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { centsToDecimal, dateOnly, decimalToCents, formatCents, isValidIsoDate, parseMoney, todayMx } from "@/lib/finance";
import {
  balanceOf, boxLabel, CASH_LABEL, computeDistribution, firstNegative, getBalances, getSplitConfig, isBox, isCash, percentToBps,
  saveSplitConfig, SPLIT_FIELDS, validateSplit, writeEntries, type Balances, type DistributionSnapshot, type SplitConfig,
} from "@/lib/ledger";

type State = { error?: string; ok?: boolean } | undefined;

const refresh = () => {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/gastos");
  revalidatePath("/finanzas/movimientos");
};

const dateField = z.string().refine(isValidIsoDate, "Indica la fecha").refine((d) => d <= todayMx(), "La fecha no puede ser futura");

/** Mensaje claro cuando una caja no tiene saldo para el cargo. */
function shortage(b: Balances, box: Box, type: CashType, cents: number): string | null {
  const have = balanceOf(b, box, type);
  return have < cents
    ? `La caja ${boxLabel(box)} solo tiene ${formatCents(have)} en ${CASH_LABEL[type].toLowerCase()} y se necesitan ${formatCents(cents)}.`
    : null;
}

// ---------- Gastos ----------
export async function createExpense(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      concept: z.string().trim().min(3, "Escribe el concepto").max(200, "El concepto es demasiado largo"),
      kind: z.enum(["NOMINA", "OTRO"]),
      method: z.enum(["EFECTIVO", "BANCO", "COMBINADO"]),
      total: z.string(),
      cash: z.string().optional(),
      bank: z.string().optional(),
      occurredOn: dateField,
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const total = parseMoney(d.total);
  if (total === null) return { error: "El monto total debe ser mayor a cero (por ejemplo 4500.00)" };
  let cash = 0;
  let bank = 0;
  if (d.method === "EFECTIVO") cash = total;
  else if (d.method === "BANCO") bank = total;
  else {
    const c = parseMoney(d.cash ?? "");
    const b = parseMoney(d.bank ?? "");
    if (c === null || b === null) return { error: "En un gasto combinado escribe cuánto sale de efectivo y cuánto de banco (ambos mayores a cero)" };
    if (c + b !== total) return { error: `Efectivo (${formatCents(c)}) + banco (${formatCents(b)}) debe sumar el monto total (${formatCents(total)})` };
    cash = c;
    bank = b;
  }

  const box: Box = d.kind === "NOMINA" ? "NOMINA" : "GASTOS";
  const on = dateOnly(d.occurredOn);
  try {
    await prisma.$transaction(async (tx) => {
      const balances = await getBalances(tx);
      const err = (cash > 0 && shortage(balances, box, "EFECTIVO", cash)) || (bank > 0 && shortage(balances, box, "BANCO", bank));
      if (err) throw new Error(err);
      const e = await tx.expense.create({
        data: { concept: d.concept, kind: d.kind, cashAmount: centsToDecimal(cash), bankAmount: centsToDecimal(bank), total: centsToDecimal(total), occurredOn: on, createdById: user.id },
      });
      await writeEntries(tx, [
        ...(cash > 0 ? [{ box, cashType: "EFECTIVO" as const, cents: -cash, kind: "GASTO" as const, occurredOn: on, createdById: user.id, expenseId: e.id, note: d.concept }] : []),
        ...(bank > 0 ? [{ box, cashType: "BANCO" as const, cents: -bank, kind: "GASTO" as const, occurredOn: on, createdById: user.id, expenseId: e.id, note: d.concept }] : []),
      ]);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el gasto" };
  }
  refresh();
  return { ok: true };
}

export async function voidExpense(id: string, reason: string): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN"]);
  if (reason.trim().length < 3) return { error: "Escribe el motivo" };
  try {
    await prisma.$transaction(async (tx) => {
      const e = await tx.expense.findUnique({ where: { id } });
      if (!e || e.voidedAt) throw new Error("El gasto no existe o ya fue anulado");
      const box: Box = e.kind === "NOMINA" ? "NOMINA" : "GASTOS";
      const cash = decimalToCents(e.cashAmount);
      const bank = decimalToCents(e.bankAmount);
      const today = dateOnly(todayMx());
      await writeEntries(tx, [
        ...(cash > 0 ? [{ box, cashType: "EFECTIVO" as const, cents: cash, kind: "ANULA_GASTO" as const, occurredOn: today, createdById: user.id, expenseId: id, note: `Anulado: ${e.concept}` }] : []),
        ...(bank > 0 ? [{ box, cashType: "BANCO" as const, cents: bank, kind: "ANULA_GASTO" as const, occurredOn: today, createdById: user.id, expenseId: id, note: `Anulado: ${e.concept}` }] : []),
      ]);
      await tx.expense.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason.trim().slice(0, 300), voidedById: user.id } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo anular" };
  }
  refresh();
  return {};
}

// ---------- Movimientos manuales ----------
export async function createMovement(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      kind: z.enum(["SALDO_INICIAL", "TRASLADO", "RETIRO"]),
      amount: z.string(),
      concept: z.string().trim().min(3, "Escribe el concepto").max(200, "El concepto es demasiado largo"),
      occurredOn: dateField,
      fromBox: z.string().optional(),
      fromType: z.string().optional(),
      toBox: z.string().optional(),
      toType: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const amount = parseMoney(d.amount);
  if (amount === null) return { error: "El monto debe ser mayor a cero (por ejemplo 1500.00)" };

  const needFrom = d.kind !== "SALDO_INICIAL";
  const needTo = d.kind !== "RETIRO";
  if (needFrom && !(d.fromBox && isBox(d.fromBox) && d.fromType && isCash(d.fromType))) return { error: "Elige la caja de la que sale el dinero y si es efectivo o banco" };
  if (needTo && !(d.toBox && isBox(d.toBox) && d.toType && isCash(d.toType))) return { error: "Elige la caja a la que entra el dinero y si es efectivo o banco" };
  const from = needFrom ? { box: d.fromBox as Box, type: d.fromType as CashType } : null;
  const to = needTo ? { box: d.toBox as Box, type: d.toType as CashType } : null;
  if (from && to && from.box === to.box && from.type === to.type) return { error: "El origen y el destino son iguales" };

  const on = dateOnly(d.occurredOn);
  try {
    await prisma.$transaction(async (tx) => {
      if (from) {
        const err = shortage(await getBalances(tx), from.box, from.type, amount);
        if (err) throw new Error(err);
      }
      const m = await tx.movement.create({
        data: {
          kind: d.kind, fromBox: from?.box ?? null, fromType: from?.type ?? null, toBox: to?.box ?? null, toType: to?.type ?? null,
          amount: centsToDecimal(amount), concept: d.concept, occurredOn: on, createdById: user.id,
        },
      });
      const kind = d.kind === "TRASLADO" ? ("TRASLADO" as const) : d.kind === "RETIRO" ? ("RETIRO" as const) : ("SALDO_INICIAL" as const);
      await writeEntries(tx, [
        ...(from ? [{ box: from.box, cashType: from.type, cents: -amount, kind, occurredOn: on, createdById: user.id, movementId: m.id, note: d.concept }] : []),
        ...(to ? [{ box: to.box, cashType: to.type, cents: amount, kind, occurredOn: on, createdById: user.id, movementId: m.id, note: d.concept }] : []),
      ]);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el movimiento" };
  }
  refresh();
  return { ok: true };
}

export async function voidMovement(id: string, reason: string): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN"]);
  if (reason.trim().length < 3) return { error: "Escribe el motivo" };
  try {
    await prisma.$transaction(async (tx) => {
      const m = await tx.movement.findUnique({ where: { id } });
      if (!m || m.voidedAt) throw new Error("El movimiento no existe o ya fue anulado");
      const entries = await tx.ledgerEntry.groupBy({ by: ["box", "cashType"], where: { movementId: id }, _sum: { amount: true } });
      const back = entries.map((e) => ({ box: e.box, cashType: e.cashType, cents: -decimalToCents(e._sum.amount ?? 0) })).filter((e) => e.cents !== 0);
      const blocked = firstNegative(await getBalances(tx), back);
      if (blocked) throw new Error(`No se puede anular: la caja ${blocked} ya no tiene saldo suficiente para deshacerlo.`);
      await writeEntries(tx, back.map((b) => ({ ...b, kind: "ANULA_MOVIMIENTO" as const, occurredOn: dateOnly(todayMx()), createdById: user.id, movementId: id, note: `Anulado: ${m.concept}` })));
      await tx.movement.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason.trim().slice(0, 300), voidedById: user.id } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo anular" };
  }
  refresh();
  return {};
}

// ---------- Porcentajes ----------
export async function saveSplit(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const cfg = { ...(await getSplitConfig()) } as SplitConfig;
  for (const f of SPLIT_FIELDS) {
    const bps = percentToBps(String(fd.get(f.key) ?? ""));
    if (bps === null) return { error: `«${f.label}»: escribe un porcentaje entre 0 y 100 (hasta 2 decimales)` };
    cfg[f.key] = bps;
  }
  const err = validateSplit(cfg);
  if (err) return { error: err };
  await saveSplitConfig(cfg);
  revalidatePath("/finanzas/configuracion");
  return { ok: true };
}

/** Reparte en las cajas los cobros que ya estaban pagados antes de existir las cajas (o cargados de un histórico). */
export async function distributePastPayments(): Promise<{ error?: string; count?: number }> {
  const user = await requireUser(["ADMIN"]);
  const cfg = await getSplitConfig();
  const pending = await prisma.invoice.findMany({ where: { status: "PAGADA", distribution: null, account: { not: null } } });
  let count = 0;
  for (const inv of pending) {
    const type: CashType = inv.account === "CAJA_CHICA" || inv.account === "JOHNNY_EFECTIVO" || inv.account === "YISUS_EFECTIVO" ? "EFECTIVO" : "BANCO";
    let lines;
    try {
      lines = computeDistribution({ subtotal: decimalToCents(inv.subtotal), vat: decimalToCents(inv.vat), isSoftware: inv.isSoftware }, cfg);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo calcular el reparto", count };
    }
    const on = inv.collectedOn ?? dateOnly(todayMx());
    await prisma.$transaction(async (tx) => {
      await writeEntries(tx, lines.map((l) => ({ box: l.box, cashType: type, cents: l.cents, kind: "DISTRIBUCION" as const, occurredOn: on, createdById: user.id, invoiceId: inv.id, note: "Reparto de cobro anterior" })));
      const snapshot: DistributionSnapshot = { cfg, cashType: type, total: decimalToCents(inv.total), lines };
      await tx.invoice.update({ where: { id: inv.id }, data: { distribution: JSON.stringify(snapshot) } });
    });
    count++;
  }
  refresh();
  revalidatePath("/finanzas/configuracion");
  return { count };
}
