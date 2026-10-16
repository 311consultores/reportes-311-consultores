import type { Box, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accountLabel, dateOnly, decimalToCents, KIND_LABEL, monthRange, todayMx } from "@/lib/finance";
import { boxLabel, CASH_LABEL, getBalances } from "@/lib/ledger";

/** Mes del filtro: sin parámetro = mes actual; "todos" = sin límite. Devuelve el texto "AAAA-MM" o "". */
export function parseMonthParam(v: string | string[] | undefined): string {
  const s = (Array.isArray(v) ? v[0] : v) ?? undefined;
  if (s === "todos") return "";
  if (s && monthRange(s, "date")) return s;
  return todayMx().slice(0, 7);
}

export type FlowRow = {
  key: string;
  date: Date;
  type: "Ingreso" | "Egreso" | "Traslado" | "Saldo inicial";
  concept: string;
  detail: string;
  cents: number;
  voided: boolean;
  href?: string;
};

/** Ingresos (cobros) y egresos (gastos y retiros) del periodo, junto con traslados y saldos iniciales. */
export async function getFlow(mes: string): Promise<{ rows: FlowRow[]; income: number; expenses: number; incomeInvoices: number; incomeReceipts: number }> {
  const range = mes ? monthRange(mes, "date") : null;
  const dateWhere = range ? { occurredOn: range } : {};

  const [paid, expenses, movements] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "PAGADA", ...(range ? { collectedOn: range } : {}) },
      include: { client: { select: { companyName: true } } },
    }),
    prisma.expense.findMany({ where: dateWhere }),
    prisma.movement.findMany({ where: dateWhere }),
  ]);

  const rows: FlowRow[] = [];
  let income = 0;
  let incomeInvoices = 0;
  let incomeReceipts = 0;
  for (const i of paid) {
    const c = decimalToCents(i.total);
    income += c;
    if (i.kind === "FACTURA") incomeInvoices += c;
    else incomeReceipts += c;
    rows.push({
      key: `i-${i.id}`, date: i.collectedOn ?? i.paidAt ?? i.sentAt, type: "Ingreso", cents: c, voided: false, href: `/facturas/${i.id}`,
      concept: `${KIND_LABEL[i.kind]}${i.number ? ` ${i.number}` : ""} · ${i.client.companyName}`,
      detail: `${accountLabel(i.account)}${i.isSoftware ? " · Software" : ""} · ${i.description}`,
    });
  }
  let out = 0;
  for (const e of expenses) {
    const c = decimalToCents(e.total);
    if (!e.voidedAt) out += c;
    const method = e.cashAmount.toNumber() > 0 && e.bankAmount.toNumber() > 0 ? "Combinado" : e.cashAmount.toNumber() > 0 ? "Efectivo" : "Banco";
    rows.push({
      key: `e-${e.id}`, date: e.occurredOn, type: "Egreso", cents: c, voided: !!e.voidedAt, href: "/finanzas/gastos",
      concept: e.concept, detail: `${e.kind === "NOMINA" ? "Caja Nómina" : "Caja Gastos"} · ${method}`,
    });
  }
  for (const m of movements) {
    const c = decimalToCents(m.amount);
    const from = m.fromBox && m.fromType ? `${boxLabel(m.fromBox)} (${CASH_LABEL[m.fromType].toLowerCase()})` : "";
    const to = m.toBox && m.toType ? `${boxLabel(m.toBox)} (${CASH_LABEL[m.toType].toLowerCase()})` : "";
    if (m.kind === "RETIRO" && !m.voidedAt) out += c;
    rows.push({
      key: `m-${m.id}`, date: m.occurredOn, type: m.kind === "RETIRO" ? "Egreso" : m.kind === "TRASLADO" ? "Traslado" : "Saldo inicial", cents: c,
      voided: !!m.voidedAt, href: "/finanzas/movimientos", concept: m.concept,
      detail: m.kind === "RETIRO" ? `Retiro de ${from}` : m.kind === "TRASLADO" ? `${from} → ${to}` : `Entrada a ${to}`,
    });
  }
  rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  return { rows, income, expenses: out, incomeInvoices, incomeReceipts };
}

/** Acumulado de facturas y recibos por estatus (todo el historial). */
export async function getReceivables() {
  const today = dateOnly(todayMx());
  const sum = async (where: Prisma.InvoiceWhereInput) => decimalToCents((await prisma.invoice.aggregate({ where, _sum: { total: true } }))._sum.total ?? 0);
  const row = async (kind: "FACTURA" | "RECIBO") => ({
    paid: await sum({ kind, status: "PAGADA" }),
    pending: await sum({ kind, status: "ENVIADA", dueDate: { gte: today } }),
    overdue: await sum({ kind, status: "ENVIADA", dueDate: { lt: today } }),
  });
  return { FACTURA: await row("FACTURA"), RECIBO: await row("RECIBO") };
}

/** Saldos por caja y lo ganado acumulado (reparto menos reversas) por caja. */
export async function getBoxes() {
  const balances = await getBalances();
  const earnedRows = await prisma.ledgerEntry.groupBy({
    by: ["box"],
    where: { kind: { in: ["DISTRIBUCION", "REVERSA"] } },
    _sum: { amount: true },
  });
  const earned = new Map<Box, number>(earnedRows.map((r) => [r.box, decimalToCents(r._sum.amount ?? 0)]));
  return { balances, earned };
}
