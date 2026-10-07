"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { requestDeletion } from "@/app/actions/deletions";
import { useDialogs } from "@/components/dialogs";

const TITLES = {
  TASK: "actividad",
  REPORT: "reporte",
  CLIENT: "cliente",
  PROJECT: "proyecto",
} as const;

export function DeleteButton({
  targetType,
  targetId,
  isAdmin,
  alreadyPending,
  onExecuted,
  label,
}: {
  targetType: "TASK" | "REPORT" | "CLIENT" | "PROJECT";
  targetId: string;
  isAdmin: boolean;
  alreadyPending: boolean;
  onExecuted: () => void;
  label: string;
}) {
  const { askReason } = useDialogs();
  const [pendingReq, setPendingReq] = useState(alreadyPending);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();

  async function click() {
    const what = TITLES[targetType];
    const reason = await askReason(
      isAdmin
        ? {
            title: `Eliminar ${what}`,
            message: `Esta acción no se puede deshacer. Indica por qué se elimina ${what === "actividad" ? "esta" : "este"} ${what}.`,
            confirmLabel: "Eliminar",
            danger: true,
          }
        : {
            title: `Solicitar eliminación de la ${what}`,
            message: "Un administrador revisará la solicitud antes de eliminar.",
            confirmLabel: "Enviar solicitud",
            danger: true,
          },
    );
    if (reason === null) return;
    setError(undefined);
    start(async () => {
      const r = await requestDeletion(targetType, targetId, reason);
      if ("error" in r && r.error) setError(r.error);
      else if ("executed" in r) onExecuted();
      else setPendingReq(true);
    });
  }

  if (pendingReq) return <span className="text-xs text-[#C93400] dark:text-[#FF9F0A]">Eliminación pendiente de aprobación</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-medium text-[#FF3B30] transition-all duration-200 ease-out hover:opacity-70 active:scale-[0.98]"
        disabled={busy}
        onClick={click}
      >
        <Trash2 size={13} /> {isAdmin ? "Eliminar" : label}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
