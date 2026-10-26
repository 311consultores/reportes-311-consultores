"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { explainMeta } from "@/app/actions/meta";

/** Botón del guía de IA: explica en lenguaje simple lo que se está viendo. No cambia nada en Meta. */
export function ExplainBox({ layer, accountId, data, label = "Explícame esto" }: { layer: "campaign" | "adset" | "ad"; accountId: string; data: unknown; label?: string }) {
  const [text, setText] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full bg-[#AF52DE]/12 px-3 py-1.5 text-xs font-semibold text-[#8944AB] transition-all hover:bg-[#AF52DE]/20 disabled:opacity-60 dark:text-[#DA8FFF]"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setError(undefined);
          start(async () => {
            const r = await explainMeta({ layer, accountId, data });
            if (r.error) setError(r.error);
            else setText(r.text);
          });
        }}
      >
        <Sparkles size={13} /> {busy ? "Pensando…" : label}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {text && (
        <div className="whitespace-pre-wrap rounded-xl border border-[#AF52DE]/25 bg-[#AF52DE]/[0.06] p-3 text-sm leading-relaxed" role="status">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#8944AB] dark:text-[#DA8FFF]">Guía de campañas</p>
          {text}
        </div>
      )}
    </div>
  );
}
