import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fmtDate, formatCents, formatDecimal, monthRange, todayMx } from "@/lib/finance";
import { parseMonthParam } from "@/lib/finance-queries";
import { getBalances, balanceOf } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { FinanzasTabs } from "../tabs";
import { VoidButton } from "../void-button";
import { ExpenseForm } from "./expense-form";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const mes = parseMonthParam(sp.mes);
  const range = mes ? monthRange(mes, "date") : null;
  const [expenses, balances] = await Promise.all([
    prisma.expense.findMany({ where: range ? { occurredOn: range } : {}, orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }], include: { createdBy: { select: { name: true } } }, take: 500 }),
    getBalances(),
  ]);
  const totalMonth = expenses.filter((e) => !e.voidedAt).reduce((s, e) => s + e.total.toNumber(), 0);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Finanzas</h1>
      <FinanzasTabs active="/finanzas/gastos" />

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Registrar gasto</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {([["NOMINA", "Caja Nómina"], ["GASTOS", "Caja Gastos"]] as const).map(([box, label]) => (
            <p key={box} className="rounded-xl bg-black/[0.03] px-4 py-2 dark:bg-white/[0.05]">
              <strong>{label}:</strong> efectivo {formatCents(balanceOf(balances, box, "EFECTIVO"))} · banco {formatCents(balanceOf(balances, box, "BANCO"))}
            </p>
          ))}
        </div>
        <ExpenseForm today={todayMx()} />
      </section>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="mes">Mes</label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className="input" />
        </div>
        <button className="btn" type="submit">Ver mes</button>
        <Link href="/finanzas/gastos?mes=todos" className="btn-outline">Todos</Link>
        <p className="meta ml-auto">Gastos del periodo (sin anulados): <strong>{formatDecimal(totalMonth)}</strong></p>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr><th className="th">Fecha</th><th className="th">Concepto</th><th className="th">Caja</th><th className="th text-right">Efectivo</th><th className="th text-right">Banco</th><th className="th text-right">Total</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {expenses.map((e) => (
              <tr key={e.id} className={cn(e.voidedAt && "opacity-60")}>
                <td className="td whitespace-nowrap">{fmtDate(e.occurredOn)}</td>
                <td className="td"><span className={cn("font-medium", e.voidedAt && "line-through")}>{e.concept}</span>
                  <span className="block text-xs text-zinc-500">{e.voidedAt ? `Anulado: ${e.voidReason}` : `Registró ${e.createdBy.name}`}</span></td>
                <td className="td">{e.kind === "NOMINA" ? "Nómina" : "Gastos"}</td>
                <td className="td text-right">{formatDecimal(e.cashAmount)}</td>
                <td className="td text-right">{formatDecimal(e.bankAmount)}</td>
                <td className={cn("td text-right font-semibold", e.voidedAt && "line-through")}>{formatDecimal(e.total)}</td>
                <td className="td">{!e.voidedAt && <VoidButton id={e.id} what="expense" />}</td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={7} className="td py-8 text-center text-zinc-500">No hay gastos en este periodo</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
