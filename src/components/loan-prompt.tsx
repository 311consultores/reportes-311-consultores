"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LoanNotice } from "@/app/actions/loans";

export const LOAN_PROMPT_EVENT = "loan-prompt";
export const LOAN_PROMPT_KEY = "loan_prompt";

/**
 * Pregunta «¿abonar a la deuda?» después de registrar un cobro. Vive en el diseño general del portal (solo para el
 * Administrador) porque la lista de facturas se actualiza al cobrar y su ventana de cobro desaparece.
 */
export function LoanPrompt() {
  const [notice, setNotice] = useState<LoanNotice>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem(LOAN_PROMPT_KEY);
        if (raw) setNotice(JSON.parse(raw) as LoanNotice);
      } catch {}
    };
    read();
    window.addEventListener(LOAN_PROMPT_EVENT, read);
    return () => window.removeEventListener(LOAN_PROMPT_EVENT, read);
  }, []);

  function dismiss() {
    try { sessionStorage.removeItem(LOAN_PROMPT_KEY); } catch {}
    setNotice(null);
  }

  if (!notice || notice.items.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && dismiss()}>
      <div className="card glass w-full max-w-md space-y-4 text-left shadow-[0_20px_60px_rgb(0,0,0,0.18)]">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Cobro registrado</h2>
          <p className="meta">Hay deuda pendiente con las cajas: <strong>{notice.total}</strong>. ¿Quieres registrar un abono?</p>
        </div>
        <ul className="space-y-1.5 text-sm">
          {notice.items.map((i) => (
            <li key={i.id}><strong>{i.concept}</strong> · falta {i.pending}<span className="block text-xs text-zinc-500">{i.boxes}</span></li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={dismiss}>Ahora no</button>
          <Link className="btn" href={`/finanzas/prestamos?abonar=${notice.items[0].id}`} onClick={dismiss}>Registrar abono</Link>
        </div>
      </div>
    </div>
  );
}
