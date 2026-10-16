"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { revertInvoicePaid } from "@/app/actions/invoices";
import { useDialogs } from "@/components/dialogs";

/** Deshacer un pago: solo el Administrador, y con motivo. */
export function RevertButton({ id }: { id: string }) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();

  async function click() {
    const reason = await askReason({
      title: "Revertir el pago",
      message: "El documento vuelve a quedar como Enviada. Explica por qué se revierte; queda en el historial.",
      confirmLabel: "Revertir",
      danger: true,
    });
    if (reason === null) return;
    setError(undefined);
    start(async () => {
      const r = await revertInvoicePaid(id, reason);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn-outline" disabled={busy} onClick={click}>
        <Undo2 size={16} /> Revertir pago
      </button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </span>
  );
}
