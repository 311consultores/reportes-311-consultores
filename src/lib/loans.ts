// Préstamos de las cajas (solo servidor): dinero que salió de una o varias cajas y se devuelve con abonos.
import type { Box, CashType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decimalToCents } from "@/lib/finance";

export type LoanStatus = "VIGENTE" | "PAGADO" | "ANULADO";

export type LoanView = {
  id: string;
  concept: string;
  recipient: string;
  loanDate: Date;
  alreadyDeducted: boolean;
  createdBy: string;
  voided: boolean;
  voidReason: string | null;
  total: number; // centavos
  paid: number;
  pending: number;
  status: LoanStatus;
  origins: { box: Box; cashType: CashType; cents: number }[];
  /** Por caja de origen: lo que se sacó, lo que ya regresó y lo que falta */
  boxes: { box: Box; owed: number; paid: number; pending: number }[];
  payments: { id: string; box: Box; cashType: CashType; cents: number; paidOn: Date; note: string | null; by: string; voided: boolean; voidReason: string | null }[];
};

/** Calcula el avance de un préstamo a partir de sus orígenes y abonos (los abonos anulados no cuentan). */
export function buildLoanView(l: {
  id: string; concept: string; recipient: string; total: unknown; loanDate: Date; alreadyDeducted: boolean; voidedAt: Date | null; voidReason: string | null;
  createdBy: { name: string };
  origins: { box: Box; cashType: CashType; amount: unknown }[];
  payments: { id: string; box: Box; cashType: CashType; amount: unknown; paidOn: Date; note: string | null; voidedAt: Date | null; voidReason: string | null; createdBy: { name: string } }[];
}): LoanView {
  const total = decimalToCents(l.total as never);
  const live = l.payments.filter((p) => !p.voidedAt);
  const paid = live.reduce((s, p) => s + decimalToCents(p.amount as never), 0);
  const owedByBox = new Map<Box, number>();
  for (const o of l.origins) owedByBox.set(o.box, (owedByBox.get(o.box) ?? 0) + decimalToCents(o.amount as never));
  const boxes = [...owedByBox.entries()].map(([box, owed]) => {
    const p = live.filter((x) => x.box === box).reduce((s, x) => s + decimalToCents(x.amount as never), 0);
    return { box, owed, paid: p, pending: Math.max(0, owed - p) };
  });
  const voided = !!l.voidedAt;
  return {
    id: l.id, concept: l.concept, recipient: l.recipient, loanDate: l.loanDate, alreadyDeducted: l.alreadyDeducted,
    createdBy: l.createdBy.name, voided, voidReason: l.voidReason,
    total, paid, pending: voided ? 0 : Math.max(0, total - paid),
    status: voided ? "ANULADO" : total - paid <= 0 ? "PAGADO" : "VIGENTE",
    origins: l.origins.map((o) => ({ box: o.box, cashType: o.cashType, cents: decimalToCents(o.amount as never) })),
    boxes,
    payments: l.payments.map((p) => ({
      id: p.id, box: p.box, cashType: p.cashType, cents: decimalToCents(p.amount as never), paidOn: p.paidOn, note: p.note,
      by: p.createdBy.name, voided: !!p.voidedAt, voidReason: p.voidReason,
    })),
  };
}

const loanInclude = {
  createdBy: { select: { name: true } },
  origins: true,
  payments: { orderBy: [{ paidOn: "asc" as const }, { createdAt: "asc" as const }], include: { createdBy: { select: { name: true } } } },
};

/** Todos los préstamos, los vigentes primero y luego los más recientes. */
export async function getLoans(): Promise<LoanView[]> {
  const rows = await prisma.loan.findMany({ orderBy: [{ loanDate: "desc" }, { createdAt: "desc" }], include: loanInclude });
  const views = rows.map(buildLoanView);
  const rank = (l: LoanView) => (l.status === "VIGENTE" ? 0 : l.status === "PAGADO" ? 1 : 2);
  return views.sort((a, b) => rank(a) - rank(b));
}

/** Resumen de la deuda: solo cuentan los préstamos que no están anulados. */
export function summarizeLoans(loans: LoanView[]) {
  const live = loans.filter((l) => !l.voided);
  const total = live.reduce((s, l) => s + l.total, 0);
  const paid = live.reduce((s, l) => s + l.paid, 0);
  return { total, paid, pending: Math.max(0, total - paid), active: live.filter((l) => l.status === "VIGENTE").length };
}
