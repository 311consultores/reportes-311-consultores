"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
import type { ReportStatus, Role } from "@prisma/client";
import { requestEdit, resolveEditRequest } from "@/app/actions/reports";
import { useDialogs } from "@/components/dialogs";

/**
 * Solicitudes de edición de un reporte Terminado.
 * TEAM 311: pide permiso con un motivo. Admin y Editor: ven la solicitud y la aprueban (el reporte vuelve a En proceso) o la rechazan.
 */
export function EditRequestPanel({
  reportId, role, status, pending,
}: {
  reportId: string;
  role: Role;
  status: ReportStatus;
  pending: { id: string; reason: string; by: string } | null;
}) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(undefined);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      router.refresh();
    });
  };

  async function ask() {
    const reason = await askReason({
      title: "Solicitar permiso de edición",
      message: "Un Administrador o Editor revisará tu solicitud. Si la aprueban, el reporte vuelve a «En proceso».",
      confirmLabel: "Enviar solicitud",
      reasonLabel: "¿Qué necesitas corregir?",
    });
    if (reason !== null) run(() => requestEdit(reportId, reason));
  }

  // TEAM 311
  if (role === "TEAM_311") {
    if (pending) {
      return <p className="card meta flex items-center gap-2"><PencilLine size={16} /> Tu solicitud de edición está pendiente de aprobación.</p>;
    }
    if (status !== "TERMINADO") return null;
    return (
      <div className="card flex flex-wrap items-center gap-3">
        <p className="meta flex-1">Este reporte ya está terminado y no se puede editar. Si necesitas cambiar algo, solicita permiso.</p>
        <button type="button" className="btn-outline" disabled={busy} onClick={ask}><PencilLine size={16} /> Solicitar edición</button>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // Admin y Editor
  if (!pending) return null;
  return (
    <div className="card space-y-3 border-l-4 border-[#FF9500]">
      <p className="text-sm"><strong>{pending.by}</strong> solicita permiso para editar este reporte.</p>
      <p className="rounded-xl bg-black/[0.04] p-3 text-sm dark:bg-white/[0.06]">{pending.reason}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={busy} onClick={() => run(() => resolveEditRequest(pending.id, true))}>Aprobar (regresa a En proceso)</button>
        <button type="button" className="btn-outline" disabled={busy} onClick={() => run(() => resolveEditRequest(pending.id, false))}>Rechazar</button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
