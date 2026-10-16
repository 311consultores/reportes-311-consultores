"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { voidExpense, voidMovement } from "@/app/actions/finance";
import { useDialogs } from "@/components/dialogs";

/** Anula un gasto o movimiento: no se borra, se devuelve a las cajas y queda el motivo. */
export function VoidButton({ id, what }: { id: string; what: "expense" | "movement" }) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();

  async function click() {
    const reason = await askReason({
      title: what === "expense" ? "Anular gasto" : "Anular movimiento",
      message: "El dinero regresa a las cajas y el registro se conserva marcado como anulado. Escribe el motivo.",
      confirmLabel: "Anular",
      danger: true,
    });
    if (reason === null) return;
    setError(undefined);
    start(async () => {
      const r = await (what === "expense" ? voidExpense : voidMovement)(id, reason);
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
