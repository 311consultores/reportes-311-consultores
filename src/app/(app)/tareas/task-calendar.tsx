"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AvatarChip } from "@/components/avatar";
import { setPreference } from "@/lib/client-cookie";
import { dayKey, formatMx, MONTH_NAMES, STATUS_INFO, toMxInput } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";
import type { TaskCard } from "./task-types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export type Birthday = { id: string; name: string; photoUrl: string | null; md: string }; // md = «MM-DD»
export type CalMode = "hoy" | "3d" | "7d" | "15d" | "mes" | "lista";

const MODES: { id: CalMode; label: string; days?: number }[] = [
  { id: "hoy", label: "Hoy", days: 1 },
  { id: "3d", label: "3 días", days: 3 },
  { id: "7d", label: "7 días", days: 7 },
  { id: "15d", label: "15 días", days: 15 },
  { id: "mes", label: "Mes" },
  { id: "lista", label: "Lista" },
];

const addDays = (key: string, n: number) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10) + n)).toISOString().slice(0, 10);
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const timeOf = (iso: string) => toMxInput(new Date(iso)).slice(11, 16);
const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions) => new Date(`${key}T12:00:00Z`).toLocaleDateString("es-MX", { timeZone: "UTC", ...opts });

/**
 * Calendario de tareas con vistas como el de Google: Hoy, 3, 7 y 15 días, Mes y una Lista de lo próximo.
 * Cada tarea aparece en su fecha de entrega con el color de su fase; los cumpleaños del equipo se pueden mostrar u ocultar.
 * Quien gestiona tareas puede arrastrar una tarea a otro día para cambiar su fecha de entrega.
 */
export function TaskCalendar({ tasks, canDrag, onOpen, onReschedule, birthdays, initialMode = "mes", initialBirthdays = true }: {
  tasks: TaskCard[]; canDrag: boolean; onOpen: (id: string) => void; onReschedule: (id: string, day: string) => void;
  birthdays: Birthday[]; initialMode?: CalMode; initialBirthdays?: boolean;
}) {
  const todayKey = dayKey(new Date());
  const [mode, setModeState] = useState<CalMode>(initialMode);
  const [anchor, setAnchor] = useState(todayKey); // primer día mostrado (o, en «Mes», cualquier día del mes)
  const [showBd, setShowBd] = useState(initialBirthdays);
  const [dragId, setDragId] = useState<string>();
  const [over, setOver] = useState<string>();

  const byDay = useMemo(() => {
    const m = new Map<string, TaskCard[]>();
    for (const t of tasks) {
      const k = dayKey(t.dueAt);
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    for (const list of m.values()) list.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    return m;
  }, [tasks]);

  const bdaysOn = (key: string) => {
    if (!showBd) return [];
    const md = key.slice(5);
    const leapFix = md === "02-28" && !isLeap(+key.slice(0, 4));
    return birthdays.filter((b) => b.md === md || (leapFix && b.md === "02-29"));
  };

  function setMode(m: CalMode) {
    setModeState(m);
    setPreference("tareas_cal_vista", m); // se recuerda la vista elegida
  }
  function toggleBd(v: boolean) {
    setShowBd(v);
    setPreference("tareas_cumples", v ? "1" : "0");
  }

  const spec = MODES.find((m) => m.id === mode)!;
  const step = spec.days ?? 0;
  const monthCursor = { y: +anchor.slice(0, 4), m: +anchor.slice(5, 7) - 1 };
  function shift(dir: 1 | -1) {
    if (mode === "mes") {
      const d = new Date(Date.UTC(monthCursor.y, monthCursor.m + dir, 1));
      setAnchor(d.toISOString().slice(0, 10));
    } else if (step) setAnchor((a) => addDays(a, dir * step));
  }

  const title =
    mode === "mes" ? `${MONTH_NAMES[monthCursor.m]} ${monthCursor.y}`
    : mode === "lista" ? "Lo próximo"
    : step === 1 ? dayLabel(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : `${dayLabel(anchor, { day: "numeric", month: "short" })} – ${dayLabel(addDays(anchor, step - 1), { day: "numeric", month: "short", year: "numeric" })}`;

  /** Celda de un día (vistas de varios días y mes): fecha, cumpleaños y tareas. */
  // Son funciones (no componentes) para que el elemento arrastrado no se vuelva a crear mientras se arrastra
  const cell = ({ k, compact, muted }: { k: string; compact?: boolean; muted?: boolean }) => {
    const list = byDay.get(k) ?? [];
    const bd = bdaysOn(k);
    const isToday = k === todayKey;
    return (
      <div
        key={k}
        onDragOver={(e) => { if (canDrag && dragId) { e.preventDefault(); setOver(k); } }}
        onDragLeave={() => setOver((o) => (o === k ? undefined : o))}
        onDrop={(e) => { e.preventDefault(); setOver(undefined); const id = e.dataTransfer.getData("text/plain") || dragId; setDragId(undefined); if (id) onReschedule(id, k); }}
        className={cn("space-y-1 bg-white p-1.5 dark:bg-zinc-900", compact ? "min-h-[6.5rem]" : "min-h-[9rem]", muted && "bg-zinc-50 opacity-60 dark:bg-zinc-900/60", over === k && "bg-[#007AFF]/10")}
      >
        {compact ? (
          <p className={cn("text-right text-xs", isToday ? "font-bold" : "text-zinc-400")}>
            {isToday ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#007AFF] px-1 text-white">{+k.slice(8)}</span> : +k.slice(8)}
          </p>
        ) : (
          <p className={cn("text-xs font-semibold capitalize", isToday ? "text-[#007AFF]" : "text-zinc-500")}>
            {dayLabel(k, { weekday: "short", day: "numeric", month: "short" })}{isToday ? " · hoy" : ""}
          </p>
        )}
        {bd.map((b) => (
          <p key={b.id} title={`Cumpleaños de ${b.name}`} className="truncate rounded-md bg-[#FF2D92]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#C2185B] dark:text-[#FF8AC4]">🎂 {b.name}</p>
        ))}
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            draggable={canDrag}
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
            onDragEnd={() => { setDragId(undefined); setOver(undefined); }}
            onClick={() => onOpen(t.id)}
            title={`${t.title} · ${t.clientName} · ${formatMx(t.dueAt)} · ${STATUS_INFO[t.status].label}`}
            className={cn("block w-full rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-white transition-opacity hover:opacity-80", compact ? "truncate" : "whitespace-normal py-1", dragId === t.id && "opacity-40", canDrag && "cursor-grab")}
            style={{ backgroundColor: STATUS_INFO[t.status].dot }}
          >
            {!compact && <span className="mr-1 font-bold">{timeOf(t.dueAt)}</span>}{t.title}
            {!compact && <span className="block text-[10px] font-normal opacity-90">{t.clientName}</span>}
          </button>
        ))}
      </div>
    );
  };

  // ----- Vista «Mes»
  const monthCells = (() => {
    const first = new Date(Date.UTC(monthCursor.y, monthCursor.m, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const dim = new Date(Date.UTC(monthCursor.y, monthCursor.m + 1, 0)).getUTCDate();
    return Array.from({ length: Math.ceil((offset + dim) / 7) * 7 }, (_, i) => {
      const d = new Date(Date.UTC(monthCursor.y, monthCursor.m, 1 - offset + i));
      return { key: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === monthCursor.m };
    });
  })();

  // ----- Vista «Lista»: vencidas, y luego lo próximo agrupado por día (con cumpleaños de los próximos 30 días)
  const upcoming = (() => {
    const open = tasks.filter((t) => t.status !== "TERMINADA").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const overdue = open.filter((t) => dayKey(t.dueAt) < todayKey);
    const groups = new Map<string, TaskCard[]>();
    for (const t of open) {
      const k = dayKey(t.dueAt);
      if (k >= todayKey) groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    const days = new Set(groups.keys());
    if (showBd) for (let i = 0; i < 30; i++) { const k = addDays(todayKey, i); if (bdaysOn(k).length) days.add(k); }
    return { overdue, keys: [...days].sort(), groups };
  })();

  const taskRow = (t: TaskCard) => (
    <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_INFO[t.status].dot }} title={STATUS_INFO[t.status].label} />
      <span className="w-12 shrink-0 font-mono text-xs text-zinc-500">{timeOf(t.dueAt)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{t.title}</span>
        <span className="meta block truncate text-xs">{t.clientName} · {t.projectName}</span>
      </span>
      <span className="hidden shrink-0 -space-x-1 sm:flex">{t.assignees.slice(0, 3).map((a) => <AvatarChip key={a.id} name={a.name} userId={a.id} photoKey={a.photoUrl} size={22} />)}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {mode !== "lista" && (
          <>
            <button type="button" className="btn-outline px-2.5" aria-label="Anterior" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
            <button type="button" className="btn-outline px-2.5" aria-label="Siguiente" onClick={() => shift(1)}><ChevronRight size={16} /></button>
            <button type="button" className="btn-outline" onClick={() => setAnchor(todayKey)}>Hoy</button>
          </>
        )}
        <h2 className="min-w-[10rem] text-lg font-semibold capitalize tracking-tight">{title}</h2>
        <span className="ml-auto inline-flex flex-wrap overflow-hidden rounded-xl border border-black/10 dark:border-white/10" role="group" aria-label="Vista del calendario">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => { setMode(m.id); if (m.id !== "mes" && m.id !== "lista") setAnchor((a) => (m.id === "hoy" ? todayKey : mode === "mes" || mode === "lista" ? todayKey : a)); }} className={cn("px-3 py-1.5 text-sm font-medium", mode === m.id ? "bg-[#007AFF] text-white" : "hover:bg-black/5 dark:hover:bg-white/10")}>{m.label}</button>
          ))}
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#FF2D92]" checked={showBd} onChange={(e) => toggleBd(e.target.checked)} /> 🎂 Mostrar cumpleaños
        </label>
      </div>
      {canDrag && mode !== "lista" && <p className="meta hidden text-xs md:block">Arrastra una tarea a otro día para cambiar su fecha de entrega (conserva la hora).</p>}

      {mode === "mes" && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[44rem] grid-cols-7 gap-px overflow-hidden rounded-2xl bg-black/10 dark:bg-white/10">
            {WEEKDAYS.map((d) => <div key={d} className="bg-black/[0.03] px-2 py-1.5 text-center text-xs font-semibold text-zinc-500 dark:bg-white/[0.04]">{d}</div>)}
            {monthCells.map((c) => cell({ k: c.key, compact: true, muted: !c.inMonth }))}
          </div>
        </div>
      )}

      {step > 0 && (
        <div className="overflow-x-auto">
          <div
            className={cn("grid gap-px overflow-hidden rounded-2xl bg-black/10 dark:bg-white/10", step === 1 && "grid-cols-1", step === 3 && "min-w-[30rem] grid-cols-3", step === 7 && "min-w-[56rem] grid-cols-7", step === 15 && "min-w-[44rem] grid-cols-5")}
          >
            {Array.from({ length: step }, (_, i) => addDays(anchor, i)).map((k) => cell({ k }))}
          </div>
        </div>
      )}

      {mode === "lista" && (
        <div className="space-y-4">
          {upcoming.overdue.length > 0 && (
            <section className="card overflow-hidden p-0">
              <h3 className="bg-[#FF3B30]/10 px-4 py-2 text-sm font-semibold text-[#D70015] dark:text-[#FF453A]">Vencidas ({upcoming.overdue.length})</h3>
              <div className="divide-y divide-black/5 dark:divide-white/10">{upcoming.overdue.map((t) => <div key={t.id}><p className="px-4 pt-2 text-[11px] font-semibold capitalize text-zinc-500">{dayLabel(dayKey(t.dueAt), { weekday: "short", day: "numeric", month: "short" })}</p>{taskRow(t)}</div>)}</div>
            </section>
          )}
          {upcoming.keys.map((k) => (
            <section key={k} className="card overflow-hidden p-0">
              <h3 className={cn("px-4 py-2 text-sm font-semibold capitalize", k === todayKey ? "bg-[#007AFF]/10 text-[#007AFF]" : "bg-black/[0.03] dark:bg-white/[0.04]")}>
                {k === todayKey ? "Hoy · " : k === addDays(todayKey, 1) ? "Mañana · " : ""}{dayLabel(k, { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <div className="divide-y divide-black/5 dark:divide-white/10">
                {bdaysOn(k).map((b) => <p key={b.id} className="px-4 py-2.5 text-sm text-[#C2185B] dark:text-[#FF8AC4]">🎂 Cumpleaños de <strong>{b.name}</strong></p>)}
                {(upcoming.groups.get(k) ?? []).map((t) => taskRow(t))}
              </div>
            </section>
          ))}
          {upcoming.overdue.length === 0 && upcoming.keys.length === 0 && <p className="card meta">No hay tareas próximas ni vencidas.</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
        {(Object.keys(STATUS_INFO) as (keyof typeof STATUS_INFO)[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_INFO[s].dot }} /> {STATUS_INFO[s].label}</span>
        ))}
        {showBd && <span className="inline-flex items-center gap-1.5">🎂 Cumpleaños</span>}
      </div>
    </div>
  );
}
