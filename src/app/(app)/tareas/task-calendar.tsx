"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey, formatMx, MONTH_NAMES, STATUS_INFO } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";
import type { TaskCard } from "./task-types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Calendario de mes completo: cada tarea aparece en su fecha de entrega, con el color de su fase. Admin y Editor pueden arrastrar para cambiar la fecha. */
export function TaskCalendar({ tasks, canDrag, onOpen, onReschedule }: {
  tasks: TaskCard[]; canDrag: boolean; onOpen: (id: string) => void; onReschedule: (id: string, day: string) => void;
}) {
  const todayKey = dayKey(new Date());
  const [cursor, setCursor] = useState(() => ({ y: Number(todayKey.slice(0, 4)), m: Number(todayKey.slice(5, 7)) - 1 }));
  const [dragId, setDragId] = useState<string>();
  const [over, setOver] = useState<string>();

  // Semanas del mes (lunes a domingo), con los días de relleno de los meses vecinos
  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m, 1 - offset + i));
    return { key: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: d.getUTCMonth() === cursor.m };
  });
  const byDay = new Map<string, TaskCard[]>();
  for (const t of tasks) {
    const k = dayKey(t.dueAt);
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const shift = (n: number) => setCursor((c) => { const d = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" className="btn-outline px-2.5" aria-label="Mes anterior" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
        <h2 className="min-w-[10rem] text-center text-lg font-semibold capitalize tracking-tight">{MONTH_NAMES[cursor.m]} {cursor.y}</h2>
        <button type="button" className="btn-outline px-2.5" aria-label="Mes siguiente" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        <button type="button" className="btn-outline" onClick={() => setCursor({ y: Number(todayKey.slice(0, 4)), m: Number(todayKey.slice(5, 7)) - 1 })}>Hoy</button>
        {canDrag && <span className="meta ml-auto hidden text-xs md:block">Arrastra una tarea a otro día para cambiar su fecha de entrega.</span>}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[44rem] grid-cols-7 gap-px overflow-hidden rounded-2xl bg-black/10 dark:bg-white/10">
          {WEEKDAYS.map((d) => <div key={d} className="bg-black/[0.03] px-2 py-1.5 text-center text-xs font-semibold text-zinc-500 dark:bg-white/[0.04]">{d}</div>)}
          {cells.map((c) => {
            const list = byDay.get(c.key) ?? [];
            return (
              <div
                key={c.key}
                onDragOver={(e) => { if (canDrag && dragId) { e.preventDefault(); setOver(c.key); } }}
                onDragLeave={() => setOver((o) => (o === c.key ? undefined : o))}
                onDrop={(e) => { e.preventDefault(); setOver(undefined); const id = e.dataTransfer.getData("text/plain") || dragId; setDragId(undefined); if (id) onReschedule(id, c.key); }}
                className={cn("min-h-[6.5rem] space-y-1 bg-white p-1.5 dark:bg-zinc-900", !c.inMonth && "bg-zinc-50 opacity-60 dark:bg-zinc-900/60", over === c.key && "bg-[#007AFF]/10")}
              >
                <p className={cn("text-right text-xs", c.key === todayKey ? "font-bold" : "text-zinc-400")}>
                  {c.key === todayKey ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#007AFF] px-1 text-white">{c.day}</span> : c.day}
                </p>
                {list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    draggable={canDrag}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                    onDragEnd={() => { setDragId(undefined); setOver(undefined); }}
                    onClick={() => onOpen(t.id)}
                    title={`${t.title} · ${t.clientName} · ${formatMx(t.dueAt)} · ${STATUS_INFO[t.status].label}`}
                    className={cn("block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-white transition-opacity hover:opacity-80", dragId === t.id && "opacity-40", canDrag && "cursor-grab")}
                    style={{ backgroundColor: STATUS_INFO[t.status].dot }}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
        {(Object.keys(STATUS_INFO) as (keyof typeof STATUS_INFO)[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_INFO[s].dot }} /> {STATUS_INFO[s].label}</span>
        ))}
      </div>
    </div>
  );
}
