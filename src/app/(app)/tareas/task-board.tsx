"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Gift, History, KanbanSquare, Plus, Search, Wand2, X } from "lucide-react";
import type { Role, TaskStatus } from "@prisma/client";
import { clearFinished, moveTask, openSurprise, rescheduleTask } from "@/app/actions/tasks";
import { getTaskCard, searchTasks, type TaskHit } from "@/app/actions/task-search";
import { Avatar } from "@/components/avatar";
import type { TeamOption } from "@/components/consultant-picker";
import { useDialogs } from "@/components/dialogs";
import { Confetti } from "@/components/confetti";
import { Modal } from "@/components/modal";
import { randomCongrats } from "@/lib/congrats-phrases";
import { isTaskManager } from "@/lib/roles";
import { canMove, dueState, formatMx, STATUS_INFO, STATUS_ORDER, STREAK_BADGES } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";
import { TaskCalendar } from "./task-calendar";
import { TaskDetail } from "./task-detail";
import { TaskForm, type ClientOption } from "./task-form";
import type { AreaOption, TaskCard, TaskPrefill } from "./task-types";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type View = null | { kind: "new" } | { kind: "edit"; id: string } | { kind: "detail"; id: string } | { kind: "accept"; id: string } | { kind: "surprise"; id: string };

/** Tablero Kanban de tareas con tarjetas arrastrables, filtros (Admin y Editor) y ventana de detalle. */
export function TaskBoard({ tasks, role, meId, clients, team, areas, openId, history, initialView = "tablero", streak = 0, prefill, notesByTask = {} }: {
  tasks: TaskCard[]; role: Role; meId: string; clients: ClientOption[]; team: TeamOption[]; areas: AreaOption[]; openId?: string; history?: boolean; initialView?: string; streak?: number; prefill?: TaskPrefill; notesByTask?: Record<string, { id: string; title: string }[]>;
}) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const isOps = isTaskManager(role);
  // Una tarea aceptada con sorpresa sin abrir se muestra primero como sorpresa
  const viewFor = (t: TaskCard): Exclude<View, null> =>
    role === "TEAM_311" && t.status === "TERMINADA" && t.surprise && !t.surpriseOpened && t.assignees.some((a) => a.id === meId) ? { kind: "surprise", id: t.id } : { kind: "detail", id: t.id };
  const [view, setView] = useState<View>(() => { if (prefill) return { kind: "new" }; const t = tasks.find((x) => x.id === openId); return t ? viewFor(t) : null; });
  const [mode, setMode] = useState<"tablero" | "calendario">(initialView === "calendario" ? "calendario" : "tablero");
  const [override, setOverride] = useState<Record<string, TaskStatus>>({});
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [prevOpenId, setPrevOpenId] = useState(openId);
  const [dragId, setDragId] = useState<string>();
  const [hover, setHover] = useState<TaskStatus>();
  const [filters, setFilters] = useState({ person: "", client: "", project: "", area: "" });
  const [q, setQ] = useState("");
  const [extra, setExtra] = useState<TaskCard | null>(null); // tarea abierta desde la búsqueda que no está en el tablero (historial)
  const [message, setMessage] = useState<string>();
  const [, startRefresh] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const nq = norm(q.trim());

  // Si se llega desde un aviso o un enlace (?tarea=…) estando ya en el tablero, se abre esa tarea
  if (openId !== prevOpenId) {
    setPrevOpenId(openId);
    const t = tasks.find((x) => x.id === openId);
    if (t) setView(viewFor(t));
  }
  // Cuando llegan datos nuevos del servidor se descartan los cambios provisionales
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setOverride({});
  }
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const list = useMemo(
    () =>
      tasks
        .map((t) => ({ ...t, status: override[t.id] ?? t.status }))
        .filter((t) => (!filters.person || t.assignees.some((a) => a.id === filters.person)) && (!filters.client || t.clientId === filters.client) && (!filters.project || t.projectId === filters.project) && (!filters.area || (filters.area === "none" ? !t.areaId : t.areaId === filters.area)))
        .filter((t) => !nq || norm([t.title, t.clientName, t.projectName, ...t.assignees.map((a) => a.name), ...t.resources.map((r) => r.title)].join(" ")).includes(nq)),
    [tasks, override, filters, nq],
  );
  const byId = (id: string) => list.find((t) => t.id === id) ?? tasks.find((t) => t.id === id) ?? (extra?.id === id ? extra : undefined);

  async function openHit(h: TaskHit) {
    setQ("");
    if (tasks.some((t) => t.id === h.id)) return setView(viewFor(tasks.find((t) => t.id === h.id)!));
    const card = await getTaskCard(h.id);
    if (card) { setExtra(card); setView(viewFor(card)); }
  }
  const projectsForFilter = clients.find((c) => c.id === filters.client)?.projects ?? [];
  const isMine = (t: TaskCard) => t.assignees.some((a) => a.id === meId);

  async function move(id: string, to: TaskStatus) {
    const t = byId(id);
    if (!t) return;
    const from = override[id] ?? t.status;
    if (!canMove(role, isMine(t), from, to)) return;
    setMessage(undefined);

    let note: string | undefined;
    let surprise: boolean | undefined;
    if (to === "TERMINADA") {
      setView({ kind: "accept", id });
      return;
    }
    if (isOps && from === "PARA_REVISAR" && to === "EN_PROCESO") {
      const r = await askReason({ title: "Devolver la tarea", message: "La tarea vuelve a «En proceso» y se avisa al equipo con tu comentario.", reasonLabel: "Comentario para el equipo", confirmLabel: "Devolver" });
      if (r === null) return;
      note = r;
    } else if (!isOps && to === "PARA_REVISAR") {
      const pend = t.subtasks.filter((s) => !s.done).length;
      const r = await askReason({ title: "Marcar la tarea como lista", message: `Se avisa a Administración para que la revise.${pend ? ` Ojo: todavía tienes ${pend} subtarea${pend === 1 ? "" : "s"} sin marcar; puedes continuar de todos modos.` : ""}`, reasonLabel: "Comentario final (opcional)", minLength: 0, confirmLabel: "¡Lista!" });
      if (r === null) return;
      note = r || undefined;
    }
    await apply(id, to, from, { note, surprise });
  }

  async function apply(id: string, to: TaskStatus, from: TaskStatus, opts: { note?: string; surprise?: boolean }) {
    setOverride((o) => ({ ...o, [id]: to }));
    const r = await moveTask(id, to, opts);
    if (r.error) {
      setOverride((o) => {
        const { [id]: _drop, ...rest } = o;
        void _drop;
        return rest;
      });
      setMessage(r.error);
    } else startRefresh(() => router.refresh());
    void from;
  }

  function changeMode(m: "tablero" | "calendario") {
    setMode(m);
    document.cookie = `tareas_vista=${m}; path=/; max-age=31536000; samesite=lax`; // se recuerda la vista elegida
  }

  async function reschedule(id: string, day: string) {
    setMessage(undefined);
    const r = await rescheduleTask(id, day);
    if (r.error) setMessage(r.error);
    else startRefresh(() => router.refresh());
  }

  const open = view && "id" in view ? byId(view.id) : undefined;
  const closeView = () => {
    setView(null);
    if (openId || prefill) router.replace(history ? "/tareas?historial=1" : "/tareas", { scroll: false }); // quita ?tarea=… o ?nota=… de la dirección
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title mr-auto">{history ? "Historial de tareas terminadas" : "Tareas"}</h1>
        {!history && isOps && (
          <>
            <button type="button" className="btn-outline" onClick={async () => { const r = await clearFinished(); setMessage(r.count ? `Se ocultaron ${r.count} tarea(s) terminada(s). Siguen en el historial.` : "No había tareas terminadas por limpiar."); router.refresh(); }}>
              <Wand2 size={16} /> Limpiar terminadas
            </button>
            <button type="button" className="btn" onClick={() => setView({ kind: "new" })}><Plus size={16} /> Nueva tarea</button>
          </>
        )}
        {!history && (
          <span className="inline-flex overflow-hidden rounded-xl border border-black/10 dark:border-white/10" role="group" aria-label="Vista">
            <button type="button" aria-pressed={mode === "tablero"} onClick={() => changeMode("tablero")} className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium", mode === "tablero" ? "bg-[#007AFF] text-white" : "hover:bg-black/5 dark:hover:bg-white/10")}><KanbanSquare size={15} /> Tablero</button>
            <button type="button" aria-pressed={mode === "calendario"} onClick={() => changeMode("calendario")} className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium", mode === "calendario" ? "bg-[#007AFF] text-white" : "hover:bg-black/5 dark:hover:bg-white/10")}><CalendarDays size={15} /> Calendario</button>
          </span>
        )}
        <Link href={history ? "/tareas" : "/tareas?historial=1"} className="btn-outline"><History size={16} /> {history ? "Volver al tablero" : "Historial"}</Link>
      </div>

      <TaskSearch q={q} setQ={setQ} onPick={openHit} />

      {isOps && (
        <div className="flex flex-wrap gap-2">
          <select className="input !w-auto" aria-label="Filtrar por persona" value={filters.person} onChange={(e) => setFilters((f) => ({ ...f, person: e.target.value }))}>
            <option value="">Todas las personas</option>
            {team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input !w-auto" aria-label="Filtrar por cliente" value={filters.client} onChange={(e) => setFilters({ ...filters, client: e.target.value, project: "" })}>
            <option value="">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input !w-auto" aria-label="Filtrar por proyecto" value={filters.project} disabled={!filters.client} onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}>
            <option value="">Todos los proyectos</option>
            {projectsForFilter.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input !w-auto" aria-label="Filtrar por área" value={filters.area} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))}>
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="none">Sin área</option>
          </select>
        </div>
      )}

      {role === "TEAM_311" && !history && <StreakBanner count={streak} />}

      {message && <p className="rounded-xl bg-[#FF9500]/10 px-4 py-2 text-sm text-[#B25E00] dark:text-[#FFB340]" role="status">{message}</p>}

      {history ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10">
              <tr><th className="th">Tarea</th><th className="th">Cliente / proyecto</th><th className="th">Personas</th><th className="th">Aceptada</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {list.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.04]" onClick={() => setView({ kind: "detail", id: t.id })}>
                  <td className="td font-medium">{t.title}</td>
                  <td className="td">{t.clientName} · {t.projectName}</td>
                  <td className="td">{t.assignees.map((a) => a.name).join(", ")}</td>
                  <td className="td whitespace-nowrap">{t.acceptedAt ? formatMx(t.acceptedAt) : "—"}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-zinc-500">Aún no hay tareas terminadas en el historial</td></tr>}
            </tbody>
          </table>
        </div>
      ) : mode === "calendario" ? (
        <TaskCalendar tasks={list} canDrag={isOps} onOpen={(id) => { const t = byId(id); if (t) setView(viewFor(t)); }} onReschedule={reschedule} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((s) => {
            const info = STATUS_INFO[s];
            const items = list.filter((t) => t.status === s);
            const droppable = dragId ? (() => { const t = byId(dragId); return !!t && canMove(role, isMine(t), t.status, s); })() : false;
            return (
              <section
                key={s}
                aria-label={info.label}
                onDragOver={(e) => { if (droppable) { e.preventDefault(); setHover(s); } }}
                onDragLeave={() => setHover((h) => (h === s ? undefined : h))}
                onDrop={(e) => { e.preventDefault(); setHover(undefined); const id = e.dataTransfer.getData("text/plain") || dragId; setDragId(undefined); if (id) move(id, s); }}
                className={cn("flex min-h-[14rem] flex-col gap-3 rounded-3xl bg-black/[0.03] p-3 transition-colors duration-200 dark:bg-white/[0.04]", hover === s && "bg-[#007AFF]/10 ring-2 ring-[#007AFF]/40")}
              >
                <header className="flex items-center justify-between gap-2 px-1">
                  <h2 className="text-sm font-bold tracking-wide" title={info.hint}>{info.emoji} {info.label}</h2>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: info.dot }}>{items.length}</span>
                </header>
                {items.map((t) => {
                  const st = dueState(t.status, t.dueAt, now);
                  const draggable = STATUS_ORDER.some((to) => canMove(role, isMine(t), t.status, to));
                  return (
                    <article
                      key={t.id}
                      draggable={draggable}
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                      onDragEnd={() => { setDragId(undefined); setHover(undefined); }}
                      onClick={() => setView(viewFor(t))}
                      className={cn("card cursor-pointer space-y-2 p-3 transition-all duration-200 ease-out hover:-translate-y-0.5", dragId === t.id && "opacity-40", st === "overdue" && "ring-2 ring-[#FF3B30]/50", st === "soon" && "ring-2 ring-[#FF9500]/50")}
                    >
                      {t.areaName && <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white" style={{ backgroundColor: t.areaColor ?? "#007AFF" }}>{t.areaName}</span>}
                      <h3 className="text-sm font-semibold leading-snug">{t.title}</h3>
                      {t.subtasks.length > 0 && (
                        <div className="space-y-1" title="Subtareas terminadas">
                          <p className="text-[11px] font-semibold text-zinc-500">✔ {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</p>
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                            <div className="h-full rounded-full bg-[#34C759] transition-all duration-300" style={{ width: `${Math.round((t.subtasks.filter((s) => s.done).length / t.subtasks.length) * 100)}%` }} />
                          </div>
                        </div>
                      )}
                      {viewFor(t).kind === "surprise" && (
                        <p className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-[#AF52DE]/15 px-2.5 py-1 text-xs font-semibold text-[#8944AB] dark:text-[#DA8FFF]"><Gift size={13} /> ¡Tienes una sorpresa! Haz clic</p>
                      )}
                      <p className="meta truncate text-xs">{t.clientName} · {t.projectName}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex -space-x-2">
                          {t.assignees.slice(0, 4).map((a) => <Avatar key={a.id} name={a.name} userId={a.id} photoKey={a.photoUrl} size={26} />)}
                          {t.assignees.length > 4 && <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold dark:bg-zinc-700">+{t.assignees.length - 4}</span>}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", st === "overdue" ? "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF453A]" : st === "soon" ? "bg-[#FF9500]/15 text-[#B25E00] dark:text-[#FFB340]" : "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300")}>
                          {st === "overdue" ? "Vencida · " : st === "soon" ? "Por vencer · " : ""}{formatMx(t.dueAt)}
                        </span>
                      </div>
                    </article>
                  );
                })}
                {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-zinc-400">Sin tareas</p>}
              </section>
            );
          })}
        </div>
      )}

      <Modal open={view?.kind === "new"} onClose={closeView} wide title="Nueva tarea" subtitle="Se asigna a quien elijas del equipo y nace en PENDIENTE">
        <TaskForm clients={clients} team={team} areas={areas} prefill={prefill} onCancel={closeView} onDone={(id) => { router.refresh(); setView({ kind: "detail", id }); }} />
      </Modal>

      <Modal open={view?.kind === "edit" && !!open} onClose={closeView} wide title="Editar tarea" subtitle={open?.title}>
        {open && <TaskForm clients={clients} team={team} areas={areas} task={open} onCancel={() => setView({ kind: "detail", id: open.id })} onDone={(id) => { router.refresh(); setView({ kind: "detail", id }); }} />}
      </Modal>

      <Modal open={view?.kind === "detail" && !!open} onClose={closeView} wide title={open?.title ?? ""} subtitle={open ? `${open.clientName} · ${open.projectName}` : undefined}>
        {open && (
          <TaskDetail
            key={open.id}
            task={open}
            notes={notesByTask[open.id] ?? []}
            role={role}
            meId={meId}
            onClose={closeView}
            onEdit={() => setView({ kind: "edit", id: open.id })}
            onMove={(to) => { closeView(); move(open.id, to); }}
          />
        )}
      </Modal>

      {view?.kind === "surprise" && open && (
        <SurpriseModal
          task={open}
          onClose={closeView}
          onReveal={async () => { await openSurprise(open.id); startRefresh(() => router.refresh()); }}
        />
      )}

      {view?.kind === "accept" && open && (
        <AcceptModal
          title={open.title}
          onCancel={closeView}
          onConfirm={async (note, surprise) => { const from = open.status; closeView(); await apply(open.id, "TERMINADA", from, { note, surprise }); }}
        />
      )}
    </div>
  );
}

/** Aceptar una tarea: comentario opcional y casilla para habilitar la «sorpresa» de felicitación. */
function AcceptModal({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: (note: string | undefined, surprise: boolean) => void }) {
  const [note, setNote] = useState("");
  const [surprise, setSurprise] = useState(true);
  return (
    <Modal open onClose={onCancel} title="Aceptar la tarea" subtitle={title}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="accept-note">Comentario para el equipo (opcional)</label>
          <textarea id="accept-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. ¡Excelente trabajo, quedó muy clara la entrega!" />
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-[#007AFF]" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} />
          🎁 Habilitar la sorpresa de felicitación
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn" onClick={() => onConfirm(note.trim() || undefined, surprise)}>Aceptar tarea</button>
        </div>
      </div>
    </Modal>
  );
}

/** Racha mensual del TEAM 311: tareas aceptadas este mes e insignias. */
function StreakBanner({ count }: { count: number }) {
  const next = STREAK_BADGES.find((b) => count < b.at);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#FFCC00]/15 px-4 py-2.5 text-sm">
      <span className="font-semibold">{count === 0 ? "Este mes aún no tienes tareas aceptadas. ¡Tú puedes!" : `¡Llevas ${count} tarea${count === 1 ? "" : "s"} aceptada${count === 1 ? "" : "s"} este mes!`}</span>
      <span className="flex items-center gap-2">
        {STREAK_BADGES.map((b) => (
          <span key={b.at} title={b.label} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", count >= b.at ? "bg-[#FFCC00] text-black" : "bg-black/5 text-zinc-400 grayscale dark:bg-white/10")}>{b.emoji} {b.at}</span>
        ))}
      </span>
      {next && count > 0 && <span className="text-xs text-zinc-500">Te faltan {next.at - count} para el {next.emoji}</span>}
    </div>
  );
}

/** Sorpresa al aceptar una tarea: se revela con confeti, una frase alegre y el comentario de quien la aceptó. */
function SurpriseModal({ task, onClose, onReveal }: { task: TaskCard; onClose: () => void; onReveal: () => Promise<void> }) {
  const [revealed, setRevealed] = useState(false);
  const [phrase] = useState(() => randomCongrats());
  return (
    <Modal open onClose={onClose} title={revealed ? "¡Felicidades!" : "¡Tienes una sorpresa!"} subtitle={task.title}>
      {revealed ? (
        <div className="space-y-4 text-center">
          <Confetti />
          <p className="text-5xl">🎉</p>
          <p className="text-lg font-semibold leading-snug">{phrase}</p>
          {task.acceptNote && (
            <blockquote className="rounded-2xl bg-black/[0.04] px-4 py-3 text-left text-sm dark:bg-white/[0.06]">
              <p className="mb-1 text-xs font-semibold text-zinc-500">Comentario de {task.acceptedBy ?? "Administración"}</p>
              {task.acceptNote}
            </blockquote>
          )}
          <button type="button" className="btn mx-auto" onClick={onClose}>¡Gracias!</button>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-6xl">🎁</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Tu tarea fue <strong>aceptada</strong> y el equipo te dejó una sorpresa. ¿La abres?</p>
          <button type="button" className="btn mx-auto" onClick={async () => { setRevealed(true); await onReveal(); }}>🎉 Abrir la sorpresa</button>
        </div>
      )}
    </Modal>
  );
}

/** Resalta las coincidencias del texto buscado. */
function Highlight({ text, q }: { text: string; q: string }) {
  const n = norm(q);
  const i = n ? norm(text).indexOf(n) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-[#FFCC00]/50 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/** Buscador predictivo: a partir de 2 letras sugiere tareas (también del historial) y a la vez filtra el tablero. */
function TaskSearch({ q, setQ, onPick }: { q: string; setQ: (v: string) => void; onPick: (h: TaskHit) => void }) {
  const [hits, setHits] = useState<{ q: string; items: TaskHit[] }>({ q: "", items: [] });
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => void searchTasks(term).then((items) => setHits({ q: term, items })).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  const term = q.trim();
  const show = focus && term.length >= 2 && hits.q === term;
  return (
    <div className="relative max-w-xl">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input
        className="input pl-10 pr-9"
        placeholder="Buscar tareas (nombre, cliente, persona, comentarios…)"
        aria-label="Buscar tareas"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        autoComplete="off"
      />
      {q && <button type="button" aria-label="Borrar búsqueda" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><X size={14} /></button>}
      {show && (
        <ul className="glass absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          {hits.items.length === 0 && <li className="px-3.5 py-2 text-sm text-zinc-500">Sin resultados</li>}
          {hits.items.map((h) => (
            <li key={h.id}>
              <button type="button" className="block w-full px-3.5 py-2 text-left text-sm hover:bg-[#007AFF]/10" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(h)}>
                <span className="flex items-center gap-2">
                  <span className="font-medium"><Highlight text={h.title} q={term} /></span>
                  {h.history && <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">Historial</span>}
                  <span className="ml-auto shrink-0 text-xs">{STATUS_INFO[h.status].emoji}</span>
                </span>
                <span className="block truncate text-xs text-zinc-500">{h.clientName} · {h.projectName}</span>
                {h.snippet && <span className="block truncate text-xs text-zinc-500">{h.field}: <Highlight text={h.snippet} q={term} /></span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
