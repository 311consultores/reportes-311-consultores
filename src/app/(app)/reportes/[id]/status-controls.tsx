"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReportStatus } from "@prisma/client";
import { changeStatus } from "@/app/actions/reports";

export function StatusControls({
  reportId,
  status,
  isAdmin,
}: {
  reportId: string;
  status: ReportStatus;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");

  function run(to: ReportStatus, c?: string) {
    setError(undefined);
    start(async () => {
      const res = await changeStatus(reportId, to, c);
      if (res.error) setError(res.error);
      else {
        setRejecting(false);
        setComment("");
        router.refresh();
      }
    });
  }

  const canFinish = status === "EN_PROCESO" || status === "RECHAZADO";
  const canReview = status === "TERMINADO" && isAdmin;
  if (!canFinish && !canReview) return null;

  return (
    <div className="space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
      <div className="flex flex-wrap gap-2">
        {canFinish && (
          <button className="btn" disabled={pending} onClick={() => run("TERMINADO")}>
            Marcar como terminado
          </button>
        )}
        {canReview && (
          <>
            <button className="btn" disabled={pending} onClick={() => run("APROBADO")}>Aprobar</button>
            <button className="btn-danger" disabled={pending} onClick={() => setRejecting(true)}>Rechazar</button>
          </>
        )}
      </div>
      {rejecting && (
        <div className="space-y-2">
          <textarea
            className="input"
            rows={3}
            placeholder="Motivo del rechazo"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn-danger" disabled={pending} onClick={() => run("RECHAZADO", comment)}>
              Confirmar rechazo
            </button>
            <button className="btn-outline" onClick={() => setRejecting(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
