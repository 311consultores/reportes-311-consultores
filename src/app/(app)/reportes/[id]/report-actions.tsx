"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReportStatus, Role } from "@prisma/client";
import { FileDown, Send } from "lucide-react";
import { sendReport } from "@/app/actions/reports";
import { DeleteButton } from "@/components/delete-button";
import { useDialogs } from "@/components/dialogs";

export function ReportActions({
  reportId,
  status,
  role,
  deletionPending,
}: {
  reportId: string;
  status: ReportStatus;
  role: Role;
  deletionPending: boolean;
}) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const isAdmin = role === "ADMIN";

  async function send() {
    const ok = await confirm({
      title: "Enviar reporte por correo",
      message: "Se enviará el PDF al cliente y a los correos del proyecto. Esta acción no se puede deshacer.",
      confirmLabel: "Enviar",
    });
    if (!ok) return;
    setMsg(undefined);
    start(async () => {
      const r = await sendReport(reportId);
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: r.dryRun ? "Enviado (modo prueba: no se envió correo real)" : "Reporte enviado" });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-4 dark:border-white/10">
      <a href={`/api/reports/${reportId}/pdf`} target="_blank" className="btn-outline">
        <FileDown size={16} /> Ver PDF
      </a>
      {role !== "CLIENTE" && status === "APROBADO" && (
        <button className="btn" onClick={send} disabled={busy}>
          <Send size={16} /> {busy ? "Enviando…" : "Enviar por correo"}
        </button>
      )}
      {role !== "CLIENTE" && (
        <DeleteButton
          targetType="REPORT"
          targetId={reportId}
          isAdmin={isAdmin}
          alreadyPending={deletionPending}
          onExecuted={() => router.push("/")}
          label="Solicitar eliminación del reporte"
        />
      )}
      {msg && <span className={msg.ok ? "text-sm text-[#248A3D] dark:text-[#30D158]" : "text-sm text-destructive"}>{msg.text}</span>}
    </div>
  );
}
