"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Box, CashType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { centsToDecimal, dateOnly, formatCents, isValidIsoDate, parseMoney, todayMx } from "@/lib/finance";
import { balanceOf, boxLabel, CASH_LABEL, firstNegative, getBalances, isBox, isCash, writeEntries } from "@/lib/ledger";
import { buildLoanView, getLoans, summarizeLoans } from "@/lib/loans";

type State = { error?: string; ok?: boolean } | undefined;

const refresh = () => {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/prestamos");
  revalidatePath("/finanzas/movimientos");
};

const dateField = z.string().refine(isValidIsoDate, "Indica la fecha").refine((d) => d <= todayMx(), "La fecha no puede ser futura");

const loanInclude = {
  createdBy: { select: { name: true } },
  origins: true,
  payments: { include: { createdBy: { select: { name: true } } } },
};

/** Registra un préstamo: de qué cajas salió el dinero (efectivo o banco) y quién lo recibió. Si el dinero ya había salido antes, no mueve saldos. */
export async function createLoan(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      concept: z.string().trim().min(3, "Escribe el concepto del préstamo").max(200, "El concepto es demasiado largo"),
      recipient: z.string().trim().min(2, "Escribe quién recibió el dinero").max(120, "El nombre es demasiado largo"),
      loanDate: dateField,
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const alreadyDeducted = fd.get("alreadyDeducted") === "on";

  const boxes = fd.getAll("originBox").map(String);
  const types = fd.getAll("originType").map(String);
  const amounts = fd.getAll("originAmount").map(String);
  const merged = new Map<string, { box: Box; cashType: CashType; cents: number }>();
  for (let i = 0; i < boxes.length; i++) {
    if (!boxes[i] && !amounts[i]?.trim()) continue; // renglón vacío
    if (!isBox(boxes[i] ?? "") || !isCash(types[i] ?? "")) return { error: "En cada renglón elige la caja y si el dinero salió de efectivo o de banco" };
    const cents = parseMoney(amounts[i] ?? "");
    if (cents === null) return { error: "El monto de cada caja debe ser mayor a cero (por ejemplo 22350.00)" };
    const k = `${boxes[i]}:${types[i]}`;
    const prev = merged.get(k);
    merged.set(k, { box: boxes[i] as Box, cashType: types[i] as CashType, cents: (prev?.cents ?? 0) + cents });
  }
  const origins = [...merged.values()];
  if (origins.length === 0) return { error: "Agrega al menos una caja de la que salió el dinero" };
  const total = origins.reduce((s, o) => s + o.cents, 0);

  const on = dateOnly(d.loanDate);
  try {
    await prisma.$transaction(async (tx) => {
      if (!alreadyDeducted) {
        const balances = await getBalances(tx);
        for (const o of origins) {
          const have = balanceOf(balances, o.box, o.cashType);
          if (have < o.cents) throw new Error(`La caja ${boxLabel(o.box)} solo tiene ${formatCents(have)} en ${CASH_LABEL[o.cashType].toLowerCase()} y se necesitan ${formatCents(o.cents)}.`);
        }
      }
      const loan = await tx.loan.create({
        data: {
          concept: d.concept, recipient: d.recipient, total: centsToDecimal(total), loanDate: on, alreadyDeducted, createdById: user.id,
          origins: { create: origins.map((o) => ({ box: o.box, cashType: o.cashType, amount: centsToDecimal(o.cents) })) },
        },
      });
      if (!alreadyDeducted) {
        await writeEntries(tx, origins.map((o) => ({ box: o.box, cashType: o.cashType, cents: -o.cents, kind: "PRESTAMO" as const, occurredOn: on, createdById: user.id, loanId: loan.id, note: `Préstamo: ${d.concept}` })));
      }
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el préstamo" };
  }
  refresh();
  return { ok: true };
}

/** Registra un abono: el dinero regresa a una de las cajas de las que salió el préstamo y sube su saldo. */
export async function addLoanPayment(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      loanId: z.string().uuid(),
      box: z.string(),
      cashType: z.string(),
      amount: z.string(),
      paidOn: dateField,
      note: z.string().trim().max(191, "La nota es demasiado larga").optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!isBox(d.box) || !isCash(d.cashType)) return { error: "Elige la caja a la que regresa el dinero y si es efectivo o banco" };
  const cents = parseMoney(d.amount);
  if (cents === null) return { error: "El abono debe ser mayor a cero (por ejemplo 1500.00)" };
  const box = d.box as Box;
  const cashType = d.cashType as CashType;
  const on = dateOnly(d.paidOn);

  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.loan.findUnique({ where: { id: d.loanId }, include: loanInclude });
      if (!row || row.voidedAt) throw new Error("El préstamo no existe o está anulado");
      const loan = buildLoanView(row);
      if (loan.status === "PAGADO") throw new Error("Este préstamo ya está pagado por completo");
      if (on < row.loanDate) throw new Error("La fecha del abono no puede ser anterior a la del préstamo");
      const b = loan.boxes.find((x) => x.box === box);
      if (!b) throw new Error(`El préstamo no salió de la caja ${boxLabel(box)}; elige una de las cajas de origen`);
      if (cents > b.pending) {
        throw new Error(b.pending === 0
          ? `La parte de la caja ${boxLabel(box)} ya está pagada; elige otra caja`
          : `El abono no puede ser mayor a lo que falta pagar a la caja ${boxLabel(box)}: ${formatCents(b.pending)}`);
      }
      const pay = await tx.loanPayment.create({
        data: { loanId: d.loanId, box, cashType, amount: centsToDecimal(cents), paidOn: on, note: d.note || null, createdById: user.id },
      });
      await writeEntries(tx, [{ box, cashType, cents, kind: "ABONO_PRESTAMO", occurredOn: on, createdById: user.id, loanId: d.loanId, loanPaymentId: pay.id, note: `Abono: ${row.concept}` }]);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el abono" };
  }
  refresh();
  return { ok: true };
}

/** Anula un abono (queda marcado con el motivo): el dinero sale otra vez de la caja a la que había regresado. */
export async function voidLoanPayment(id: string, reason: string): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN"]);
  if (reason.trim().length < 3) return { error: "Escribe el motivo" };
  try {
    await prisma.$transaction(async (tx) => {
      const p = await tx.loanPayment.findUnique({ where: { id }, include: { loan: { select: { concept: true } } } });
      if (!p || p.voidedAt) throw new Error("El abono no existe o ya fue anulado");
      const cents = Math.round(Number(p.amount.toString()) * 100);
      const blocked = firstNegative(await getBalances(tx), [{ box: p.box, cashType: p.cashType, cents: -cents }]);
      if (blocked) throw new Error(`No se puede anular: la caja ${blocked} ya no tiene saldo suficiente para deshacerlo.`);
      await writeEntries(tx, [{ box: p.box, cashType: p.cashType, cents: -cents, kind: "ANULA_ABONO", occurredOn: dateOnly(todayMx()), createdById: user.id, loanId: p.loanId, loanPaymentId: p.id, note: `Anulado: abono de ${p.loan.concept}` }]);
      await tx.loanPayment.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason.trim().slice(0, 300), voidedById: user.id } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo anular el abono" };
  }
  refresh();
  return {};
}

/** Anula un préstamo (no se borra): si el dinero salió de las cajas al registrarlo, regresa a ellas. Primero deben anularse sus abonos. */
export async function voidLoan(id: string, reason: string): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN"]);
  if (reason.trim().length < 3) return { error: "Escribe el motivo" };
  try {
    await prisma.$transaction(async (tx) => {
      const l = await tx.loan.findUnique({ where: { id }, include: { origins: true, payments: { where: { voidedAt: null }, select: { id: true } } } });
      if (!l || l.voidedAt) throw new Error("El préstamo no existe o ya fue anulado");
      if (l.payments.length > 0) throw new Error("Este préstamo ya tiene abonos. Anula primero sus abonos y luego el préstamo.");
      if (!l.alreadyDeducted) {
        await writeEntries(tx, l.origins.map((o) => ({
          box: o.box, cashType: o.cashType, cents: Math.round(Number(o.amount.toString()) * 100), kind: "ANULA_PRESTAMO" as const,
          occurredOn: dateOnly(todayMx()), createdById: user.id, loanId: id, note: `Anulado: préstamo ${l.concept}`,
        })));
      }
      await tx.loan.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason.trim().slice(0, 300), voidedById: user.id } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo anular el préstamo" };
  }
  refresh();
  return {};
}

export type LoanNotice = { total: string; items: { id: string; concept: string; pending: string; boxes: string }[] } | null;

/** Aviso para la ventana de cobro de una factura: préstamos con deuda pendiente (solo lo ve el Administrador; para los demás es null). */
export async function loanNotice(): Promise<LoanNotice> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  const loans = (await getLoans()).filter((l) => l.status === "VIGENTE");
  if (loans.length === 0) return null;
  return {
    total: formatCents(summarizeLoans(loans).pending),
    items: loans.map((l) => ({
      id: l.id, concept: l.concept, pending: formatCents(l.pending),
      boxes: l.boxes.filter((b) => b.pending > 0).map((b) => `${boxLabel(b.box)} ${formatCents(b.pending)}`).join(" · "),
    })),
  };
}
