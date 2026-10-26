"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeScore, resetRanking, type RetasState } from "@/app/actions/retas";
import { Avatar } from "@/components/avatar";
import { useDialogs } from "@/components/dialogs";
import { cn } from "@/lib/utils";
import type { Ranking } from "@/lib/retas";
import { RetasGame } from "./retas-game";

const MEDAL = ["🥇", "🥈", "🥉"];

function Table({ r, meId, admin, crown, onRemove }: { r: Ranking; meId: string; admin: boolean; crown: boolean; onRemove: (userId: string, name: string) => void }) {
  return (
    <ol className="divide-y divide-black/5 dark:divide-white/10">
      {r.rows.map((row) => (
        <li key={row.userId} className={cn("flex items-center gap-3 px-1 py-2", row.userId === meId && "rounded-xl bg-[#007AFF]/10 px-2")}>
          <span className="w-7 shrink-0 text-center text-sm font-semibold text-zinc-500">{MEDAL[row.position - 1] ?? row.position}</span>
          <Avatar name={row.name} userId={row.userId} photoKey={row.photoUrl} size={30} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {crown && row.position === 1 && <span title="Primer lugar del mes" className="mr-1">👑</span>}
            {row.name}{row.userId === meId ? " (tú)" : ""}
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">{row.score}</span>
          {admin && (
            <button type="button" aria-label={`Quitar el puntaje de ${row.name}`} title="Quitar este puntaje" onClick={() => onRemove(row.userId, row.name)} className="rounded-full p-1 text-zinc-400 hover:bg-black/5 hover:text-red-600 dark:hover:bg-white/10"><Trash2 size={14} /></button>
          )}
        </li>
      ))}
      {r.rows.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">Todavía nadie ha jugado. ¡Sé el primero!</li>}
    </ol>
  );
}

/** Las Retas: el juego a la izquierda y el ranking (del mes y de siempre) a la derecha. El Administrador puede quitar puntajes o reiniciar el ranking. */
export function RetasApp({ initial, meId, isAdmin }: { initial: RetasState; meId: string; isAdmin: boolean }) {
  const [state, setState] = useState(initial);
  const [tab, setTab] = useState<"month" | "all">("month");
  const [busy, start] = useTransition();
  const { confirm } = useDialogs();
  const current = tab === "month" ? state.month : state.all;

  async function remove(userId: string, name: string) {
    const ok = await confirm({ title: "Quitar puntaje", message: `Se quitará el puntaje de ${name} de la tabla «${tab === "month" ? "Del mes" : "De siempre"}».`, confirmLabel: "Quitar", danger: true });
    if (ok) start(async () => setState(await removeScore(userId, tab)));
  }
  async function reset(scope: "month" | "all") {
    const ok = await confirm({ title: "Reiniciar ranking", message: scope === "month" ? `Se borrarán todos los puntajes de ${state.monthLabel}. Esta acción no se puede deshacer.` : "Se borrarán todos los puntajes de siempre. Esta acción no se puede deshacer.", confirmLabel: "Reiniciar", danger: true });
    if (ok) start(async () => setState(await resetRanking(scope)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Las Retas</h1>
        <p className="meta">Un descanso entre tareas: corre, salta y agáchate para esquivar los obstáculos. Tu mejor puntaje compite en el ranking del equipo. Jugar no cuenta para tu desempeño.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_21rem]">
        <RetasGame bestMonth={state.month.mine?.score ?? 0} bestAll={state.all.mine?.score ?? 0} onState={setState} />
        <aside className="card h-fit space-y-3">
          <div className="flex overflow-hidden rounded-xl border border-black/10 text-sm dark:border-white/10" role="tablist" aria-label="Ranking">
            <button type="button" role="tab" aria-selected={tab === "month"} onClick={() => setTab("month")} className={cn("flex-1 px-3 py-1.5 font-medium capitalize", tab === "month" ? "bg-[#007AFF] text-white" : "hover:bg-black/5 dark:hover:bg-white/10")}>Del mes · {state.monthLabel}</button>
            <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className={cn("flex-1 px-3 py-1.5 font-medium", tab === "all" ? "bg-[#007AFF] text-white" : "hover:bg-black/5 dark:hover:bg-white/10")}>De siempre</button>
          </div>
          <Table r={current} meId={meId} admin={isAdmin} crown={tab === "month"} onRemove={remove} />
          {current.mine && current.mine.position > current.rows.length && (
            <p className="rounded-xl bg-black/[0.04] px-3 py-2 text-sm dark:bg-white/[0.06]">Tu lugar: <b>#{current.mine.position}</b> con <b>{current.mine.score}</b> puntos</p>
          )}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 border-t border-black/5 pt-3 dark:border-white/10">
              <button type="button" className="btn-outline text-xs" disabled={busy} onClick={() => reset("month")}>Reiniciar el del mes</button>
              <button type="button" className="btn-outline text-xs" disabled={busy} onClick={() => reset("all")}>Reiniciar el de siempre</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
