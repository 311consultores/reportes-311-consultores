"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { voidExpense, voidMovement } from "@/app/actions/finance";
import { voidLoan, voidLoanPayment } from "@/app/actions/loans";
import { useDialogs } from "@/components/dialogs";

const COPY = {
  expense: { title: "Anular gasto", message: "El dinero regresa a las cajas y el registro se conserva marcado como anulado. Escribe el motivo.", run: voidExpense },
  movement: { title: "Anular movimiento", message: "El dinero regresa a las cajas y el registro se conserva marcado como anulado. Escribe el motivo.", run: voidMovement },
  loan: { title: "Anular préstamo", message: "El préstamo se conserva marcado como anulado y deja de contar en la deuda. Si el dinero salió de las cajas al registrarlo, regresa a ellas. Escribe el motivo.", run: voidLoan },
  payment: { title: "Anular abono", message: "El dinero del abono sale otra vez de la caja a la que había regresado y la deuda vuelve a subir. El abono se conserva marcado como anulado. Escribe el motivo.", run: voidLoanPayment },
} as const;

/** Anula un gasto, movimiento, préstamo o abono: no se borra, se devuelve a las cajas y queda el motivo. */
export function VoidButton({ id, what }: { id: string; what: keyof typeof COPY }) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();
  const copy = COPY[what];

  async function click() {
    const reason = await askReason({ title: copy.title, message: copy.message, confirmLabel: "Anular", danger: true });
    if (reason === null) return;
    setError(undefined);
    start(async () => {
      const r = await copy.run(id, reason);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={busy} onClick={click} className="inline-flex items-center gap-1 text-xs font-medium text-[#FF3B30] transition-all duration-200 ease-out hover:opacity-70 active:scale-[0.98]">
        <Ban size={13} /> Anular
      </button>
      {error && <span className="max-w-[16rem] text-xs text-destructive">{error}</span>}
    </span>
  );
}
