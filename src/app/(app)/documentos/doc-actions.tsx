"use client";

import { useState, useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import { deleteDraft, duplicateDocument } from "@/app/actions/documents";
import { useDialogs } from "@/components/dialogs";

/** Duplicar (hacer una nueva versión) y eliminar borradores que nunca se enviaron. */
export function DocActions({ id, draft, canDelete }: { id: string; draft: boolean; canDelete: boolean }) {
  const { confirm } = useDialogs();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <>
      <button type="button" className="btn-outline" disabled={busy} onClick={() => start(async () => { const r = await duplicateDocument(id); if (r?.error) setError(r.error); })}>
        <Copy size={15} /> Duplicar
      </button>
      {draft && canDelete && (
        <button
          type="button"
          className="btn-outline text-red-600"
          disabled={busy}
          onClick={async () => {
            if (!(await confirm({ title: "Eliminar borrador", message: "El borrador se elimina por completo (nunca se envió). Esta acción no se puede deshacer.", confirmLabel: "Eliminar", danger: true }))) return;
            start(async () => { const r = await deleteDraft(id); if (r?.error) setError(r.error); });
          }}
        >
          <Trash2 size={15} /> Eliminar borrador
        </button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </>
  );
}
