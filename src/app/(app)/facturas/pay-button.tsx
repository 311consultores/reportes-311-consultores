"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceKind } from "@prisma/client";
import { markInvoicePaid } from "@/app/actions/invoices";
import { loanNotice, type LoanNotice } from "@/app/actions/loans";
import { DateInput } from "@/components/date-input";
import { LOAN_PROMPT_EVENT, LOAN_PROMPT_KEY } from "@/components/loan-prompt";
import { accountsFor, STATUS_LABEL, type DisplayStatus } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { PILL_STYLE } from "./status-pill";

/** El estatus «Enviada/Vencida» es un botón: al hacer clic se abre la ventana para registrar el cobro. */
export function PayButton({
  id, kind, status, today, label,
}: {
  id: string;
  kind: InvoiceKind;
  status: Exclude<DisplayStatus, "PAGADA">;
  today: string;
  label?: string; // descripción corta que se muestra en la ventana (p. ej. el folio)
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  const [notice, setNotice] = useState<LoanNotice>(null); // deuda con las cajas (solo la ve el Administrador)
  const accounts = accountsFor(kind);

  function confirm() {
    setError(undefined);
    start(async () => {
      const r = await markInvoicePaid(id, account, date);
      if (r.error) setError(r.error);
      else {
        if (notice) {
          // La lista se actualiza al cobrar y esta ventana desaparece: la pregunta «¿abonar?» la muestra el diseño general
          try { sessionStorage.setItem(LOAN_PROMPT_KEY, JSON.stringify(notice)); } catch {}
          window.dispatchEvent(new Event(LOAN_PROMPT_EVENT));
        }
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        title="Clic para marcar como pagada"
        onClick={() => {
          setAccount("");
          setDate(today);
          setError(undefined);
          setNotice(null);
          loanNotice().then(setNotice).catch(() => {});
          setOpen(true);
        }}
        className={cn("rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ease-out hover:opacity-70 active:scale-[0.97]", PILL_STYLE[status])}
      >
        {STATUS_LABEL[status]}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="card glass w-full max-w-md space-y-4 text-left shadow-[0_20px_60px_rgb(0,0,0,0.18)]">
            {notice && (
              <p className="rounded-xl bg-[#FF9500]/12 px-3 py-2 text-xs text-[#B25E00] dark:text-[#FFB340]">Hay deuda pendiente con las cajas ({notice.total}). Al terminar podrás registrar un abono.</p>
            )}
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Marcar como pagada</h2>
              <p className="meta">{label ? `${label}. ` : ""}Indica en qué cuenta se recibió el dinero.</p>
            </div>
            <div>
              <label className="label" htmlFor={`acc-${id}`}>Cuenta receptora</label>
              <select id={`acc-${id}`} className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">Selecciona…</option>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>{a.label} · {a.type === "EFECTIVO" ? "efectivo" : "banco"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fecha en que entró el dinero</label>
              <DateInput value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn" disabled={busy || !account || !date} onClick={confirm}>
                {busy ? "Guardando…" : "Marcar como pagada"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
