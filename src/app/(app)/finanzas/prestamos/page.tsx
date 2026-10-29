import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fmtDate, formatCents, todayMx } from "@/lib/finance";
import { boxLabel, CASH_LABEL } from "@/lib/ledger";
import { getLoans, summarizeLoans, type LoanStatus, type LoanView } from "@/lib/loans";
import { cn } from "@/lib/utils";
import { FinanzasTabs } from "../tabs";
import { VoidButton } from "../void-button";
import { LoanForm, type LoanPrefill } from "./loan-form";
import { PaymentForm } from "./payment-form";

const STATUS_STYLE: Record<LoanStatus, string> = {
  VIGENTE: "bg-[#FF9500]/15 text-[#B25E00] dark:text-[#FFB340]",
  PAGADO: "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]",
  ANULADO: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};
const STATUS_LABEL: Record<LoanStatus, string> = { VIGENTE: "Vigente", PAGADO: "Pagado", ANULADO: "Anulado" };

/** Datos del préstamo inicial de la caja Navidad (se carga con el botón que aparece mientras no haya préstamos). */
const INITIAL_LOAN: LoanPrefill = {
  concept: "Préstamo de la caja Navidad", recipient: "La empresa", date: "2026-10-17", alreadyDeducted: true,
  rows: [{ box: "NAVIDAD", type: "BANCO", amount: "22350.00" }],
};

const Kpi = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "green" }) => (
  <div className="card space-y-1">
    <p className="meta">{label}</p>
    <p className={cn("text-2xl font-semibold tracking-tight", tone === "red" && "text-[#D70015] dark:text-[#FF453A]", tone === "green" && "text-[#248A3D] dark:text-[#30D158]")}>{value}</p>
    {hint && <p className="text-xs text-zinc-500">{hint}</p>}
  </div>
);

function LoanCard({ loan, today, openPayment }: { loan: LoanView; today: string; openPayment: boolean }) {
  const pct = loan.total > 0 ? Math.min(100, Math.round((loan.paid / loan.total) * 100)) : 0;
  const from = loan.origins.map((o) => `${boxLabel(o.box)} (${CASH_LABEL[o.cashType].toLowerCase()}) ${formatCents(o.cents)}`).join(" · ");
  return (
    <section id={`prestamo-${loan.id}`} className={cn("card space-y-4", loan.voided && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className={cn("text-lg font-semibold tracking-tight", loan.voided && "line-through")}>{loan.concept}</h2>
          <p className="meta">Recibió: {loan.recipient} · {fmtDate(loan.loanDate)} · Registró {loan.createdBy}</p>
          <p className="text-xs text-zinc-500">Salió de: {from}{loan.alreadyDeducted ? " · el dinero ya había salido de las cajas antes de registrarlo" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("rounded-full px-3 py-1 text-xs font-medium", STATUS_STYLE[loan.status])}>{STATUS_LABEL[loan.status]}</span>
          {!loan.voided && <VoidButton id={loan.id} what="loan" />}
        </div>
      </div>
      {loan.voided && <p className="text-sm text-zinc-500">Anulado: {loan.voidReason}</p>}

      {!loan.voided && (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span>Abonado <strong>{formatCents(loan.paid)}</strong> de {formatCents(loan.total)}</span>
              <span className={cn("font-semibold", loan.pending > 0 ? "text-[#D70015] dark:text-[#FF453A]" : "text-[#248A3D] dark:text-[#30D158]")}>
                {loan.pending > 0 ? `Falta ${formatCents(loan.pending)}` : "Pagado por completo"}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del pago">
              <div className="h-full rounded-full bg-[#34C759] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-zinc-500">{pct}% pagado{loan.boxes.length > 1 ? ` · ${loan.boxes.map((b) => `${boxLabel(b.box)}: falta ${formatCents(b.pending)}`).join(" · ")}` : ""}</p>
          </div>

          {loan.payments.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="border-b border-black/5 dark:border-white/10">
                  <tr><th className="th">Fecha</th><th className="th">Regresó a</th><th className="th">Nota</th><th className="th text-right">Abono</th><th className="th" /></tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/10">
                  {loan.payments.map((p) => (
                    <tr key={p.id} className={cn(p.voided && "opacity-60")}>
                      <td className="td whitespace-nowrap">{fmtDate(p.paidOn)}</td>
                      <td className="td text-xs">{boxLabel(p.box)} ({CASH_LABEL[p.cashType].toLowerCase()})</td>
                      <td className="td text-xs text-zinc-500">{p.voided ? `Anulado: ${p.voidReason}` : p.note ? `${p.note} · ${p.by}` : `Registró ${p.by}`}</td>
                      <td className={cn("td text-right font-semibold", p.voided && "line-through")}>{formatCents(p.cents)}</td>
                      <td className="td">{!p.voided && <VoidButton id={p.id} what="payment" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loan.status === "VIGENTE" && (
            <details open={openPayment} className="group rounded-xl border border-black/5 p-3 dark:border-white/10">
              <summary className="cursor-pointer text-sm font-medium"><span className="btn-outline inline-flex px-3.5 py-1.5 text-xs"><Plus size={14} /> Registrar abono</span></summary>
              <div className="pt-3">
                <PaymentForm
                  loanId={loan.id}
                  today={today}
                  boxes={loan.boxes.map((b) => ({ value: b.box, label: boxLabel(b.box), pending: formatCents(b.pending), pendingCents: b.pending }))}
                />
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

export default async function LoansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const today = todayMx();
  const loans = await getLoans();
  const sum = summarizeLoans(loans);
  const pctAll = sum.total > 0 ? Math.round((sum.paid / sum.total) * 100) : 0;
  const prefill = sp.inicial === "1" ? INITIAL_LOAN : undefined;
  const abonar = typeof sp.abonar === "string" ? sp.abonar : "";

  return (
    <div className="space-y-6">
      <h1 className="page-title">Finanzas</h1>
      <FinanzasTabs active="/finanzas/prestamos" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Deuda pendiente" value={formatCents(sum.pending)} hint={`${sum.active} préstamo(s) vigente(s)`} tone={sum.pending > 0 ? "red" : "green"} />
        <Kpi label="Abonado" value={formatCents(sum.paid)} hint={`${pctAll}% de ${formatCents(sum.total)} prestados`} tone="green" />
        <Kpi label="Total prestado" value={formatCents(sum.total)} hint="Sin contar los anulados" />
      </div>

      {loans.length === 0 && !prefill && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Aún no hay préstamos. ¿Quieres registrar el préstamo inicial de la caja Navidad?</p>
          <Link href="/finanzas/prestamos?inicial=1" className="btn-outline">Cargar el préstamo de Navidad</Link>
        </div>
      )}

      <details open={!!prefill} className="card space-y-4">
        <summary className="cursor-pointer list-none"><span className="btn"><Plus size={16} /> Registrar préstamo</span></summary>
        <div className="pt-4">
          <p className="meta mb-3">Un préstamo es dinero que se sacó de una o varias cajas. Después se va devolviendo con abonos hasta completar la deuda.</p>
          <LoanForm today={today} prefill={prefill} />
        </div>
      </details>

      <div className="space-y-4">
        {loans.map((l) => <LoanCard key={l.id} loan={l} today={today} openPayment={abonar === l.id} />)}
      </div>
    </div>
  );
}
