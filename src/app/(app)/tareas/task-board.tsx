"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Plus, Wand2 } from "lucide-react";
import type { Role, TaskStatus } from "@prisma/client";
import { clearFinished, moveTask } from "@/app/actions/tasks";
import { Avatar } from "@/components/avatar";
import type { TeamOption } from "@/components/consultant-picker";
import { useDialogs } from "@/components/dialogs";
import { Modal } from "@/components/modal";
import { canMove, dueState, formatMx, STATUS_INFO, STATUS_ORDER } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";
import { TaskDetail } from "./task-detail";
import { TaskForm, type ClientOption } from "./task-form";
import type { TaskCard } from "./task-types";

type View = null | { kind: "new" } | { kind: "edit"; id: string } | { kind: "detail"; id: string } | { kind: "accept"; id: string };

/** Tablero Kanban de tareas con tarjetas arrastrables, filtros (Admin y Editor) y ventana de detalle. */
export function TaskBoard({ tasks, role, meId, clients, team, openId, history }: {
  tasks: TaskCard[]; role: Role; meId: string; clients: ClientOption[]; team: TeamOption[]; openId?: string; history?: boolean;
}) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const isOps = role === "ADMIN" || role === "EDITOR";
  const [view, setView] = useState<View>(openId && tasks.some((t) => t.id === openId) ? { kind: "detail", id: openId } : null);
  const [override, setOverride] = useState<Record<string, TaskStatus>>({});
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [prevOpenId, setPrevOpenId] = useState(openId);
  const [dragId, setDragId] = useState<string>();
  const [hover, setHover] = useState<TaskStatus>();
  const [filters, setFilters] = useState({ person: "", client: "", project: "" });
  const [message, setMessage] = useState<string>();
  const [, startRefresh] = useTransition();
  const [now, setNow] = useState(() => new Date());

  // Si se llega desde un aviso o un enlace (?tarea=…) estando ya en el tablero, se abre esa tarea
  if (openId !== prevOpenId) {
    setPrevOpenId(openId);
    if (openId && tasks.some((t) => t.id === openId)) setView({ kind: "detail", id: openId });
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
        .filter((t) => (!filters.person || t.assignees.some((a) => a.id === filters.person)) && (!filters.client || t.clientId === filters.client) && (!filters.project || t.projectId === filters.project)),
    [tasks, override, filters],
  );
  const byId = (id: string) => list.find((t) => t.id === id) ?? tasks.find((t) => t.id === id);
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
      const r = await askReason({ title: "Marcar la tarea como lista", message: "Se avisa a Administración para que la revise.", reasonLabel: "Comentario final (opcional)", minLength: 0, confirmLabel: "¡Lista!" });
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

  const open = view && "id" in view ? byId(view.id) : undefined;
  const closeView = () => {
    setView(null);
    if (openId) router.replace(history ? "/tareas?historial=1" : "/tareas", { scroll: false }); // quita ?tarea=… para poder reabrirla
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
        <Link href={history ? "/tareas" : "/tareas?historial=1"} className="btn-outline"><History size={16} /> {history ? "Volver al tablero" : "Historial"}</Link>
      </div>

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
        </div>
      )}

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
                      onClick={() => setView({ kind: "detail", id: t.id })}
                      className={cn("card cursor-pointer space-y-2 p-3 transition-all duration-200 ease-out hover:-translate-y-0.5", dragId === t.id && "opacity-40", st === "overdue" && "ring-2 ring-[#FF3B30]/50", st === "soon" && "ring-2 ring-[#FF9500]/50")}
                    >
                      <h3 className="text-sm font-semibold leading-snug">{t.title}</h3>
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

      <Modal open={view?.kind === "new"} onClose={closeView} wide title="Nueva tarea" subtitle="Se asigna al equipo TEAM 311 y nace en PENDIENTE">
        <TaskForm clients={clients} team={team} onCancel={closeView} onDone={(id) => { router.refresh(); setView({ kind: "detail", id }); }} />
      </Modal>

      <Modal open={view?.kind === "edit" && !!open} onClose={closeView} wide title="Editar tarea" subtitle={open?.title}>
        {open && <TaskForm clients={clients} team={team} task={open} onCancel={() => setView({ kind: "detail", id: open.id })} onDone={(id) => { router.refresh(); setView({ kind: "detail", id }); }} />}
      </Modal>

      <Modal open={view?.kind === "detail" && !!open} onClose={closeView} wide title={open?.title ?? ""} subtitle={open ? `${open.clientName} · ${open.projectName}` : undefined}>
        {open && (
          <TaskDetail
            key={open.id}
            task={open}
            role={role}
            meId={meId}
            onClose={closeView}
            onEdit={() => setView({ kind: "edit", id: open.id })}
            onMove={(to) => { closeView(); move(open.id, to); }}
          />
        )}
      </Modal>

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
