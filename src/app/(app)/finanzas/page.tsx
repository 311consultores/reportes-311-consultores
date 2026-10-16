import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fmtDate, formatCents } from "@/lib/finance";
import { getBoxes, getFlow, getReceivables, parseMonthParam } from "@/lib/finance-queries";
import { balanceOf, BOXES, type BoxInfo } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { FinanzasTabs } from "./tabs";

const Kpi = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "green" }) => (
  <div className="card space-y-1">
    <p className="meta">{label}</p>
    <p className={cn("text-2xl font-semibold tracking-tight", tone === "red" && "text-[#D70015] dark:text-[#FF453A]", tone === "green" && "text-[#248A3D] dark:text-[#30D158]")}>{value}</p>
    {hint && <p className="text-xs text-zinc-500">{hint}</p>}
  </div>
);

const GROUPS: { id: BoxInfo["group"]; title: string }[] = [
  { id: "operativa", title: "Cajas de la empresa" },
  { id: "iva", title: "Cajas del IVA" },
  { id: "socio", title: "Utilidad individual de los socios" },
];

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const mes = parseMonthParam(sp.mes);
  const [flow, receivables, { balances, earned }] = await Promise.all([getFlow(mes), getReceivables(), getBoxes()]);

  let cash = 0;
  let bank = 0;
  for (const b of BOXES) {
    cash += balanceOf(balances, b.value, "EFECTIVO");
    bank += balanceOf(balances, b.value, "BANCO");
  }
  const period = mes ? new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }) : "todo el historial";
  const net = flow.income - flow.expenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">Finanzas</h1>
        <a href={`/api/finanzas/export?mes=${mes || "todos"}`} className="btn-outline"><Download size={16} /> Exportar a Excel</a>
      </div>
      <FinanzasTabs active="/finanzas" />

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="mes">Mes</label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className="input" />
        </div>
        <button className="btn" type="submit">Ver mes</button>
        <Link href="/finanzas?mes=todos" className="btn-outline">Todo el historial</Link>
        <p className="meta ml-auto">Periodo: <strong className="inline-block first-letter:uppercase">{period}</strong></p>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ingresos del periodo" value={formatCents(flow.income)} hint={`Facturas ${formatCents(flow.incomeInvoices)} · Recibos ${formatCents(flow.incomeReceipts)}`} tone="green" />
        <Kpi label="Egresos del periodo" value={formatCents(flow.expenses)} hint="Gastos y retiros" tone="red" />
        <Kpi label="Balance del periodo" value={formatCents(net)} hint="Ingresos − egresos" />
        <Kpi label="Dinero en cajas hoy" value={formatCents(cash + bank)} hint={`Efectivo ${formatCents(cash)} · Banco ${formatCents(bank)}`} />
      </div>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Facturas y pagos sin factura (acumulado)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="th">Tipo</th><th className="th text-right">Pagado</th><th className="th text-right">Pendiente por cobrar</th><th className="th text-right">Vencido</th></tr></thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {([["FACTURA", "Con factura"], ["RECIBO", "Sin factura (recibos simples)"]] as const).map(([k, label]) => (
                <tr key={k}>
                  <td className="td font-medium">{label}</td>
                  <td className="td text-right">{formatCents(receivables[k].paid)}</td>
                  <td className="td text-right">{formatCents(receivables[k].pending)}</td>
                  <td className="td text-right text-[#D70015] dark:text-[#FF453A]">{formatCents(receivables[k].overdue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {GROUPS.map((g) => (
        <section key={g.id} className="card space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{g.title}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Caja</th>
                  <th className="th text-right">Efectivo</th>
                  <th className="th text-right">Banco</th>
                  <th className="th text-right">Total</th>
                  {g.id === "socio" && <th className="th text-right">Ganado acumulado</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {BOXES.filter((b) => b.group === g.id).map((b) => {
                  const e = balanceOf(balances, b.value, "EFECTIVO");
                  const k = balanceOf(balances, b.value, "BANCO");
                  return (
                    <tr key={b.value}>
                      <td className="td"><span className="font-medium">{b.label}</span>{b.hint && <span className="block text-xs text-zinc-500">{b.hint}</span>}</td>
                      <td className="td text-right">{formatCents(e)}</td>
                      <td className="td text-right">{formatCents(k)}</td>
                      <td className="td text-right font-semibold">{formatCents(e + k)}</td>
                      {g.id === "socio" && <td className="td text-right">{formatCents(earned.get(b.value) ?? 0)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Ingresos y egresos · <span className="inline-block first-letter:uppercase">{period}</span></h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-black/5 dark:border-white/10">
              <tr><th className="th">Fecha</th><th className="th">Tipo</th><th className="th">Concepto</th><th className="th text-right">Monto</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {flow.rows.map((r) => (
                <tr key={r.key} className={cn(r.voided && "opacity-50")}>
                  <td className="td whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="td">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium",
                      r.type === "Ingreso" ? "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]" : r.type === "Egreso" ? "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF453A]" : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300")}>
                      {r.type}
                    </span>
                    {r.voided && <span className="ml-1 text-xs text-zinc-500">Anulado</span>}
                  </td>
                  <td className="td"><Link href={r.href ?? "#"} className={cn("font-medium", r.voided && "line-through")}>{r.concept}</Link><span className="block text-xs text-zinc-500">{r.detail}</span></td>
                  <td className={cn("td whitespace-nowrap text-right font-medium", r.voided && "line-through")}>{r.type === "Egreso" ? "−" : ""}{formatCents(r.cents)}</td>
                </tr>
              ))}
              {flow.rows.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-zinc-500">No hay movimientos en este periodo</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
