import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { LedgerKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fmtDate, formatCents, formatDecimal, KIND_LABEL, monthRange } from "@/lib/finance";
import { parseMonthParam } from "@/lib/finance-queries";
import { balanceOf, boxLabel, CASH_LABEL, getBalances, isBox } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { FinanzasTabs } from "../../tabs";

const ENTRY_LABEL: Record<LedgerKind, string> = {
  DISTRIBUCION: "Reparto de un cobro",
  REVERSA: "Reversa de un cobro",
  GASTO: "Gasto",
  ANULA_GASTO: "Anulación de gasto",
  SALDO_INICIAL: "Saldo inicial",
  TRASLADO: "Traslado",
  RETIRO: "Retiro",
  ANULA_MOVIMIENTO: "Anulación de movimiento",
  PRESTAMO: "Préstamo",
  ABONO_PRESTAMO: "Abono a préstamo",
  ANULA_PRESTAMO: "Anulación de préstamo",
  ANULA_ABONO: "Anulación de abono",
};

/** Historial de una caja: todo lo que ha entrado y salido de ella (reparto de cobros, gastos, traslados, retiros y préstamos). */
export default async function BoxHistoryPage({ params, searchParams }: { params: Promise<{ box: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["ADMIN"]);
  const { box } = await params;
  if (!isBox(box)) notFound();
  const sp = await searchParams;
  const mes = parseMonthParam(sp.mes);
  const range = mes ? monthRange(mes, "date") : null;

  const [balances, entries] = await Promise.all([
    getBalances(),
    prisma.ledgerEntry.findMany({
      where: { box, ...(range ? { occurredOn: range } : {}) },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: { invoice: { select: { id: true, kind: true, number: true, client: { select: { companyName: true } } } } },
    }),
  ]);
  const cash = balanceOf(balances, box, "EFECTIVO");
  const bank = balanceOf(balances, box, "BANCO");
  const periodTotal = entries.reduce((s, e) => s + Math.round(e.amount.toNumber() * 100), 0);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Finanzas</h1>
      <FinanzasTabs active="/finanzas" />
      <Link href="/finanzas" className="btn-outline inline-flex"><ArrowLeft size={16} /> Volver a Finanzas</Link>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card space-y-1"><p className="meta">Caja</p><p className="text-2xl font-semibold tracking-tight">{boxLabel(box)}</p></div>
        <div className="card space-y-1"><p className="meta">Saldo hoy</p><p className="text-2xl font-semibold tracking-tight">{formatCents(cash + bank)}</p><p className="text-xs text-zinc-500">Efectivo {formatCents(cash)} · Banco {formatCents(bank)}</p></div>
        <div className="card space-y-1"><p className="meta">Cambio en el periodo</p><p className={cn("text-2xl font-semibold tracking-tight", periodTotal < 0 ? "text-[#D70015] dark:text-[#FF453A]" : "text-[#248A3D] dark:text-[#30D158]")}>{formatCents(periodTotal)}</p><p className="text-xs text-zinc-500">Entradas menos salidas</p></div>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="mes">Mes</label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className="input" />
        </div>
        <button className="btn" type="submit">Ver mes</button>
        <Link href={`/finanzas/caja/${box}?mes=todos`} className="btn-outline">Todo el historial</Link>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr><th className="th">Fecha</th><th className="th">Tipo</th><th className="th">Concepto</th><th className="th">Dinero</th><th className="th text-right">Monto</th></tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="td whitespace-nowrap">{fmtDate(e.occurredOn)}</td>
                <td className="td">{ENTRY_LABEL[e.kind]}</td>
                <td className="td">
                  {e.invoice ? (
                    <Link href={`/facturas/${e.invoice.id}`} className="font-medium">{KIND_LABEL[e.invoice.kind]}{e.invoice.number ? ` ${e.invoice.number}` : ""} · {e.invoice.client.companyName}</Link>
                  ) : (
                    <span className="font-medium">{e.note || "—"}</span>
                  )}
                </td>
                <td className="td">{CASH_LABEL[e.cashType]}</td>
                <td className={cn("td whitespace-nowrap text-right font-semibold", e.amount.toNumber() < 0 && "text-[#D70015] dark:text-[#FF453A]")}>{formatDecimal(e.amount)}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={5} className="td py-8 text-center text-zinc-500">No hay movimientos de esta caja en este periodo</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
