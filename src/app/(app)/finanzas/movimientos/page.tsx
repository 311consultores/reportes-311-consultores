import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fmtDate, formatDecimal, monthRange, todayMx } from "@/lib/finance";
import { parseMonthParam } from "@/lib/finance-queries";
import { boxLabel, CASH_LABEL } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { FinanzasTabs } from "../tabs";
import { VoidButton } from "../void-button";
import { MovementForm } from "./movement-form";

const KIND_LABEL = { SALDO_INICIAL: "Saldo inicial", TRASLADO: "Traslado", RETIRO: "Retiro" } as const;

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const mes = parseMonthParam(sp.mes);
  const range = mes ? monthRange(mes, "date") : null;
  const moves = await prisma.movement.findMany({
    where: range ? { occurredOn: range } : {},
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
    take: 500,
  });

  return (
    <div className="space-y-6">
      <h1 className="page-title">Finanzas</h1>
      <FinanzasTabs active="/finanzas/movimientos" />

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Registrar movimiento de cajas</h2>
        <MovementForm today={todayMx()} />
      </section>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="mes">Mes</label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className="input" />
        </div>
        <button className="btn" type="submit">Ver mes</button>
        <Link href="/finanzas/movimientos?mes=todos" className="btn-outline">Todos</Link>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr><th className="th">Fecha</th><th className="th">Tipo</th><th className="th">Concepto</th><th className="th">Origen → destino</th><th className="th text-right">Monto</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {moves.map((m) => (
              <tr key={m.id} className={cn(m.voidedAt && "opacity-60")}>
                <td className="td whitespace-nowrap">{fmtDate(m.occurredOn)}</td>
                <td className="td">{KIND_LABEL[m.kind]}</td>
                <td className="td"><span className={cn("font-medium", m.voidedAt && "line-through")}>{m.concept}</span>
                  <span className="block text-xs text-zinc-500">{m.voidedAt ? `Anulado: ${m.voidReason}` : `Registró ${m.createdBy.name}`}</span></td>
                <td className="td text-xs">
                  {m.fromBox && m.fromType ? `${boxLabel(m.fromBox)} (${CASH_LABEL[m.fromType].toLowerCase()})` : "—"}
                  {" → "}
                  {m.toBox && m.toType ? `${boxLabel(m.toBox)} (${CASH_LABEL[m.toType].toLowerCase()})` : "fuera de la empresa"}
                </td>
                <td className={cn("td text-right font-semibold", m.voidedAt && "line-through")}>{formatDecimal(m.amount)}</td>
                <td className="td">{!m.voidedAt && <VoidButton id={m.id} what="movement" />}</td>
              </tr>
            ))}
            {moves.length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-zinc-500">No hay movimientos en este periodo</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
