"use server";

import { revalidatePath } from "next/cache";
import type { Box } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { centsToDecimal, dateOnly, decimalToCents, formatCents, parseMoney, todayMx } from "@/lib/finance";
import { balanceOf, boxLabel, CASH_LABEL, getBalances, isBox, writeEntries } from "@/lib/ledger";
import { notifyUsers } from "@/lib/notifications";

type Res = { error?: string; ok?: boolean };

const refresh = () => {
  revalidatePath("/reembolsos");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/gastos");
};

/** El ADMINISTRADOR aprueba el reembolso (todavía no se paga). */
export async function approveReimbursement(id: string): Promise<Res> {
  const admin = await requireUser(["ADMIN"]);
  const r = await prisma.reimbursement.updateMany({ where: { id, status: "SOLICITADO" }, data: { status: "APROBADO", reviewedById: admin.id, reviewedAt: new Date(), rejectReason: null } });
  if (!r.count) return { error: "El reembolso ya no está en «Solicitado»" };
  const row = await prisma.reimbursement.findUniqueOrThrow({ where: { id } });
  await notifyUsers([row.requestedById], { actorId: admin.id, kind: "REIMB_RESULT", title: `Tu reembolso fue aprobado: ${row.concept}`, body: `${formatCents(decimalToCents(row.amount))} — se te pagará pronto.`, link: "/reembolsos" });
  refresh();
  return { ok: true };
}

/** El ADMINISTRADOR rechaza el reembolso con un motivo. */
export async function rejectReimbursement(id: string, reason: string): Promise<Res> {
  const admin = await requireUser(["ADMIN"]);
  const why = reason.trim();
  if (why.length < 3) return { error: "Escribe el motivo del rechazo" };
  const r = await prisma.reimbursement.updateMany({ where: { id, status: { in: ["SOLICITADO", "APROBADO"] } }, data: { status: "RECHAZADO", reviewedById: admin.id, reviewedAt: new Date(), rejectReason: why.slice(0, 300) } });
  if (!r.count) return { error: "El reembolso ya no se puede rechazar" };
  const row = await prisma.reimbursement.findUniqueOrThrow({ where: { id } });
  await notifyUsers([row.requestedById], { actorId: admin.id, kind: "REIMB_RESULT", title: `Tu reembolso fue rechazado: ${row.concept}`, body: why, link: "/reembolsos" });
  refresh();
  return { ok: true };
}

/**
 * El ADMINISTRADOR paga un reembolso aprobado: elige la caja y cómo se divide (efectivo/banco).
 * Queda como un gasto (egreso) de esa caja; no se paga de una caja sin saldo.
 */
export async function payReimbursement(id: string, input: { box: string; cash: string; bank: string }): Promise<Res> {
  const admin = await requireUser(["ADMIN"]);
  if (!isBox(input.box)) return { error: "Elige la caja de la que saldrá el pago" };
  const box: Box = input.box;
  const cash = input.cash.trim() ? parseMoney(input.cash) : 0;
  const bank = input.bank.trim() ? parseMoney(input.bank) : 0;
  if (cash === null || bank === null) return { error: "Los montos deben ser mayores a cero (por ejemplo 350.00)" };
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.reimbursement.findUnique({ where: { id } });
      if (!r || r.status !== "APROBADO") throw new Error("Solo se pueden pagar reembolsos aprobados");
      const total = decimalToCents(r.amount);
      if (cash + bank !== total) throw new Error(`Efectivo (${formatCents(cash)}) + banco (${formatCents(bank)}) debe sumar ${formatCents(total)}`);
      const balances = await getBalances(tx);
      for (const [type, cents] of [["EFECTIVO", cash], ["BANCO", bank]] as const) {
        if (cents > 0 && balanceOf(balances, box, type) < cents) {
          throw new Error(`La caja ${boxLabel(box)} solo tiene ${formatCents(balanceOf(balances, box, type))} en ${CASH_LABEL[type].toLowerCase()} y se necesitan ${formatCents(cents)}.`);
        }
      }
      const on = dateOnly(todayMx());
      const who = (await tx.user.findUnique({ where: { id: r.requestedById }, select: { name: true } }))?.name ?? "";
      const concept = `Reembolso a ${who}: ${r.concept}`.slice(0, 200);
      const e = await tx.expense.create({
        data: { concept, kind: "OTRO", box, cashAmount: centsToDecimal(cash), bankAmount: centsToDecimal(bank), total: centsToDecimal(total), occurredOn: on, createdById: admin.id },
      });
      await writeEntries(tx, [
        ...(cash > 0 ? [{ box, cashType: "EFECTIVO" as const, cents: -cash, kind: "GASTO" as const, occurredOn: on, createdById: admin.id, expenseId: e.id, note: concept }] : []),
        ...(bank > 0 ? [{ box, cashType: "BANCO" as const, cents: -bank, kind: "GASTO" as const, occurredOn: on, createdById: admin.id, expenseId: e.id, note: concept }] : []),
      ]);
      await tx.reimbursement.update({ where: { id }, data: { status: "PAGADO", paidById: admin.id, paidAt: new Date(), expenseId: e.id } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el pago" };
  }
  const row = await prisma.reimbursement.findUniqueOrThrow({ where: { id } });
  await notifyUsers([row.requestedById], { actorId: admin.id, kind: "REIMB_RESULT", title: `¡Te pagaron tu reembolso!: ${row.concept}`, body: formatCents(decimalToCents(row.amount)), link: "/reembolsos" });
  refresh();
  return { ok: true };
}
