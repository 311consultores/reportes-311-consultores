"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { toggleRegistroLink } from "@/app/actions/registros";
import { CopyButton } from "@/components/copy-button";
import { useDialogs } from "@/components/dialogs";

export function LinkCard({ url, active, isAdmin }: { url: string; active: boolean; isAdmin: boolean }) {
  const { confirm } = useDialogs();
  const [isActive, setActive] = useState(active);
  const [busy, start] = useTransition();

  async function toggle() {
    const next = !isActive;
    const ok = await confirm({
      title: next ? "Activar el enlace de registro" : "Desactivar el enlace de registro",
      message: next
        ? "Cualquier persona con el enlace podrá enviar su registro."
        : "El enlace dejará de aceptar registros hasta que lo actives de nuevo. Los registros ya recibidos no se pierden.",
      confirmLabel: next ? "Activar" : "Desactivar",
      danger: !next,
    });
    if (!ok) return;
    start(async () => {
      await toggleRegistroLink(next);
      setActive(next);
    });
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Enlace de registro para clientes</h2>
          <p className="meta">Compártelo con tus clientes para que capturen sus datos. Cada registro llega aquí para revisarlo.</p>
        </div>
        <span
          className={
            isActive
              ? "rounded-full bg-[#34C759]/15 px-3 py-1 text-xs font-medium text-[#248A3D] dark:text-[#30D158]"
              : "rounded-full bg-[#FF3B30]/10 px-3 py-1 text-xs font-medium text-[#D70015] dark:text-[#FF453A]"
          }
        >
          {isActive ? "Activo" : "Desactivado"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.04]">
        <code className="min-w-0 flex-1 break-all text-sm">{url}</code>
        <CopyButton text={url} label="Copiar enlace" />
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#007AFF] hover:bg-[#007AFF]/10">
          <ExternalLink size={13} /> Abrir
        </a>
      </div>

      {isAdmin && (
        <button type="button" className={isActive ? "btn-outline" : "btn"} onClick={toggle} disabled={busy}>
          {isActive ? "Desactivar enlace" : "Activar enlace"}
        </button>
      )}
    </section>
  );
}
