"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Paperclip, X } from "lucide-react";
import { approveReimbursement, payReimbursement, rejectReimbursement } from "@/app/actions/reimbursements";
import { useDialogs } from "@/components/dialogs";
import { PaySplitModal, type BalanceMap } from "@/components/pay-split-modal";
import { fmtDate, formatCents } from "@/lib/finance";
import { STATUS_COLOR, STATUS_LABEL, urgencyLabel, type ReimbStatus } from "@/lib/reimbursements";
import { cn } from "@/lib/utils";

export type ReimbRow = {
  id: string; who: string; concept: string; cents: number; spentOn: string; urgency: string; client: string | null; project: string | null;
  status: ReimbStatus; rejectReason: string | null; receiptName: string; receiptType: string; createdAt: string; paidAt: string | null;
};

const FILTERS: { value: "TODOS" | ReimbStatus; label: string }[] = [
  { value: "TODOS", label: "Todos" }, { value: "SOLICITADO", label: "Solicitados" }, { value: "APROBADO", label: "Aprobados (por pagar)" }, { value: "PAGADO", label: "Pagados" }, { value: "RECHAZADO", label: "Rechazados" },
];

/** Lista de reembolsos: la persona ve los suyos; el ADMINISTRADOR ve todos y los aprueba, rechaza y paga. */
export function ReimbursementList({ rows, isAdmin, balances, openId }: { rows: ReimbRow[]; isAdmin: boolean; balances: BalanceMap; openId?: string }) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [filter, setFilter] = useState<"TODOS" | ReimbStatus>(isAdmin ? "SOLICITADO" : "TODOS");
  const [paying, setPaying] = useState<ReimbRow | null>(null);
  const [error, setError] = useState<string>();
  const shown = rows.filter((r) => filter === "TODOS" || r.status === filter);
  const count = (s: ReimbStatus) => rows.filter((r) => r.status === s).length;

  async function approve(r: ReimbRow) {
    setError(undefined);
    const res = await approveReimbursement(r.id);
    if (res.error) setError(res.error);
    else router.refresh();
  }
  async function reject(r: ReimbRow) {
    const why = await askReason({ title: "Rechazar reembolso", message: `Se avisará a ${r.who} con tu motivo.`, reasonLabel: "Motivo del rechazo", confirmLabel: "Rechazar", danger: true });
    if (why === null) return;
    setError(undefined);
    const res = await rejectReimbursement(r.id, why);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)} className={cn("rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all duration-200", filter === f.value ? "bg-[#007AFF] text-white shadow-sm" : "glass text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10")}>
            {f.label}{f.value !== "TODOS" && count(f.value) > 0 ? ` (${count(f.value)})` : ""}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {shown.length === 0 ? (
        <p className="card meta">No hay reembolsos en esta vista.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className={cn("card space-y-2", openId === r.id && "ring-2 ring-[#007AFF]/50")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.concept}</p>
                  <p className="meta text-xs">
                    {isAdmin ? `${r.who} · ` : ""}Gasto del {fmtDate(new Date(`${r.spentOn}T00:00:00Z`))}
                    {r.client ? ` · ${r.client}${r.project ? ` / ${r.project}` : ""}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{formatCents(r.cents)}</p>
                  <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status] }}>{STATUS_LABEL[r.status]}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", r.urgency === "URGE" ? "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF453A]" : "bg-black/5 dark:bg-white/10")}>{urgencyLabel(r.urgency)}</span>
                <a href={`/api/reembolsos/${r.id}/comprobante`} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-xs"><Paperclip size={13} /> Ver comprobante</a>
                {r.paidAt && <span className="meta text-xs">Pagado el {new Date(r.paidAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" })}</span>}
              </div>
              {r.status === "RECHAZADO" && r.rejectReason && <p className="rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-sm text-[#D70015] dark:text-[#FF453A]">Motivo: {r.rejectReason}</p>}
              {isAdmin && (r.status === "SOLICITADO" || r.status === "APROBADO") && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {r.status === "SOLICITADO" && <button type="button" className="btn px-3 py-1.5 text-xs" onClick={() => approve(r)}><Check size={14} /> Aprobar</button>}
                  {r.status === "APROBADO" && <button type="button" className="btn px-3 py-1.5 text-xs" onClick={() => setPaying(r)}>Registrar pago</button>}
                  <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => reject(r)}><X size={14} /> Rechazar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {paying && (
        <PaySplitModal
          open onClose={() => setPaying(null)} title="Pagar reembolso" subtitle={`${paying.who} · ${paying.concept}`} totalCents={paying.cents} balances={balances}
          onPay={async (v) => { const res = await payReimbursement(paying.id, { box: v.box, cash: v.cash, bank: v.bank }); if (!res.error) router.refresh(); return res; }}
        />
      )}
    </section>
  );
}
