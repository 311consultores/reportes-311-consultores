"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Clock, ExternalLink, Link2, MessageCircle, Pencil, Plus, Wand2, X } from "lucide-react";
import type { Role, TaskStatus } from "@prisma/client";
import { AvatarChip } from "@/components/avatar";
import { DeleteButton } from "@/components/delete-button";
import { RichTextView } from "@/components/rich-text";
import { isTaskManager } from "@/lib/roles";
import { useDialogs } from "@/components/dialogs";
import { ConsultantPicker, type TeamOption } from "@/components/consultant-picker";
import { isPublishedIso } from "@/lib/task-schedule";
import { taskAssignMessage } from "@/lib/whatsapp";
import { randomTaskPhrase } from "@/lib/task-phrases";
import { canMove, EVENT_LABEL, formatMx, remainingText, STATUS_INFO, STATUS_ORDER } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";
import { addTaskAssignees, removeTaskAssignee, toggleSubtask } from "@/app/actions/tasks";
import { TaskChat } from "./task-chat";
import { SendToClientModal } from "../revisiones/send-to-client-modal";
import type { TaskCard } from "./task-types";

const eventNote = (kind: string, note: string | null) =>
  kind === "MOVED" && note ? note.replace(/[A-Z_]+/g, (k) => (STATUS_INFO[k as TaskStatus]?.label.toLowerCase() ?? k)).replace(" → ", " → ") : note;

/** Cuerpo de la ventana de detalle de una tarea (estilo Trello): contenido a la izquierda y mini-panel a la derecha. */
export function TaskDetail({ task, notes = [], team = [], role, meId, onMove, onEdit, onClose }: {
  task: TaskCard; notes?: { id: string; title: string }[]; team?: TeamOption[]; role: Role; meId: string; onMove: (to: TaskStatus) => void; onEdit: () => void; onClose: () => void;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [phrase] = useState(() => randomTaskPhrase()); // cambia cada vez que se abre la ventana
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const isOps = isTaskManager(role);
  const mine = task.assignees.some((a) => a.id === meId);
  const info = STATUS_INFO[task.status];
  const rem = remainingText(task.dueAt, now);
  const active = task.status === "PENDIENTE" || task.status === "EN_PROCESO";
  const targets = STATUS_ORDER.filter((s) => canMove(role, mine, task.status, s));
  const canReady = role === "TEAM_311" && mine && active;
  const locked = task.status === "TERMINADA" && !isOps; // el TEAM 311 solo consulta
  // Enlace de la tarea para copiar y mandar por WhatsApp (solo quien gestiona tareas)
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string>();
  const taskUrl = typeof window === "undefined" ? "" : `${window.location.origin}/tareas?tarea=${task.id}`;
  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
  }
  async function copyLink() {
    await copyText(taskUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  // El botón de WhatsApp copia el mensaje (con el nombre de todas las personas asignadas) para pegarlo en WhatsApp
  async function copyMessage() {
    await copyText(taskAssignMessage(task.assignees.map((a) => a.name), task.title, taskUrl));
    setToast("Mensaje copiado");
    setTimeout(() => setToast(undefined), 3000);
  }
  // Agregar o quitar personas sin abrir «Editar»
  const { confirm } = useDialogs();
  const [adding, setAdding] = useState(false);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [assignError, setAssignError] = useState<string>();
  const [busyAssign, setBusyAssign] = useState(false);
  const addable = team.filter((p) => !task.assignees.some((a) => a.id === p.id));
  async function addPeople() {
    setAssignError(undefined);
    setBusyAssign(true);
    const r = await addTaskAssignees(task.id, newIds);
    setBusyAssign(false);
    if (r.error) return setAssignError(r.error);
    setAdding(false); setNewIds([]); setPickerKey((k) => k + 1);
    router.refresh();
  }
  async function removePerson(id: string, name: string) {
    const ok = await confirm({ title: "Quitar de la tarea", message: `Se quitará a ${name} de esta tarea y se le avisará que ya no es suya.`, confirmLabel: "Quitar" });
    if (!ok) return;
    setAssignError(undefined);
    const r = await removeTaskAssignee(task.id, id);
    if (r.error) setAssignError(r.error);
    else router.refresh();
  }
  const scheduled = isOps && !isPublishedIso(task.publishAt, now);
  // Subtareas: se marcan al instante (Admin/Editor siempre; el TEAM asignado mientras la tarea no esté aceptada)
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const subs = task.subtasks.map((s) => ({ ...s, done: local[s.id] ?? s.done }));
  const doneCount = subs.filter((s) => s.done).length;
  const allDone = subs.length > 0 && doneCount === subs.length;
  const canCheck = isOps || (mine && !locked);
  const [sendReview, setSendReview] = useState(false); // ventana «Enviar al cliente» de una tarea de revisión
  async function checkSub(id: string, done: boolean) {
    setLocal((l) => ({ ...l, [id]: done }));
    const r = await toggleSubtask(id, done);
    if (r.error) setLocal((l) => { const { [id]: _x, ...rest } = l; void _x; return rest; });
    else {
      router.refresh();
      if (r.reviewId) setSendReview(true);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_17rem]">
      {/* Izquierda: contenido */}
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${info.dot}1f`, color: info.dot }}>
            {info.emoji} {info.label}
          </span>
          {task.areaName && <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide text-white" style={{ backgroundColor: task.areaColor ?? "#007AFF" }}>{task.areaName}</span>}
          {scheduled && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5856D6]/15 px-3 py-1 text-xs font-semibold text-[#4B49C0] dark:text-[#A5A3FF]" title="La persona asignada aún no la ve"><Clock size={13} /> Programada · aparece {formatMx(task.publishAt as string)}</span>}
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">Asignada a</h3>
          <div className="flex flex-wrap items-center gap-2">
            {task.assignees.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-0.5">
                <AvatarChip name={a.name} userId={a.id} photoKey={a.photoUrl} size={26} />
                {isOps && task.assignees.length > 1 && (
                  <button type="button" aria-label={`Quitar a ${a.name}`} title={`Quitar a ${a.name}`} onClick={() => removePerson(a.id, a.name)} className="rounded-full p-1 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><X size={13} /></button>
                )}
              </span>
            ))}
            {isOps && (
              <button type="button" aria-expanded={adding} onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-black/20 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-black/5 dark:border-white/25 dark:text-zinc-300 dark:hover:bg-white/10"><Plus size={13} /> Agregar</button>
            )}
            {isOps && (
              <button type="button" onClick={copyMessage} title="Copia el mensaje para pegarlo en WhatsApp" aria-label="WhatsApp: copiar mensaje" className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2.5 py-1 text-xs font-semibold text-[#128C4A] transition-all hover:bg-[#25D366]/25 dark:text-[#4ADE80]">
                <MessageCircle size={13} /> WhatsApp
              </button>
            )}
            {toast && <span role="status" className="rounded-full bg-[#34C759]/15 px-2.5 py-1 text-xs font-semibold text-[#1E7B3A] dark:text-[#6EE7A0]">✔ {toast}</span>}
          </div>
          {adding && isOps && (
            <div className="mt-2 space-y-2 rounded-xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
              <ConsultantPicker key={pickerKey} options={addable} onChange={setNewIds} hint="Se les avisa que se les asignó la tarea." emptyText="No hay más personas disponibles" searchText="Escribe para buscar a quién agregar…" />
              <div className="flex items-center gap-2">
                <button type="button" className="btn px-3 py-1.5 text-xs" disabled={busyAssign || newIds.length === 0} onClick={addPeople}>{busyAssign ? "Agregando…" : "Agregar a la tarea"}</button>
                <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => { setAdding(false); setNewIds([]); setPickerKey((k) => k + 1); }}>Cancelar</button>
              </div>
            </div>
          )}
          {assignError && <p className="mt-1 text-xs text-destructive">{assignError}</p>}
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">Creada por</h3>
          <AvatarChip name={task.createdBy.name} userId={task.createdBy.id} photoKey={task.createdBy.photoUrl} size={26} />
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">Descripción</h3>
          <RichTextView html={task.descriptionHtml} />
        </div>

        {task.subtasks.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              Subtareas <span className="text-xs font-normal text-zinc-500">{doneCount}/{task.subtasks.length}</span>
            </h3>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-[#34C759] transition-all duration-300" style={{ width: `${Math.round((doneCount / task.subtasks.length) * 100)}%` }} />
            </div>
            <ul className="space-y-1.5">
              {subs.map((s) => (
                <li key={s.id} className="flex items-start gap-2.5 rounded-xl bg-black/[0.03] px-3 py-2 text-sm dark:bg-white/[0.04]">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#34C759]" checked={s.done} disabled={!canCheck} aria-label={s.title} onChange={(e) => checkSub(s.id, e.target.checked)} />
                  <span className="min-w-0 flex-1">
                    <span className={cn(s.done && "text-zinc-400 line-through")}>{s.title}</span>
                    {task.reviewId && s.reviewSlideId && <Link href={`/revisiones/${task.reviewId}?slide=${s.reviewSlideId}`} className="link ml-2 inline-flex items-center gap-0.5 text-xs font-medium"><ExternalLink size={11} /> Abrir slide</Link>}
                    <span className="block text-xs text-zinc-500">
                      {s.assigneeName ?? "Sin responsable"}{s.dueAt ? ` · entrega ${formatMx(s.dueAt)}` : ""}
                      {s.done && s.doneByName ? ` · ✔ ${s.doneByName}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {allDone && canReady && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-[#34C759]/15 px-3 py-2 text-sm">
                <span>🎉 ¡Terminaste todas las subtareas! ¿Marcas la tarea como lista?</span>
                <button type="button" className="btn px-3 py-1 text-xs" onClick={() => onMove("PARA_REVISAR")}><Wand2 size={13} /> Lista</button>
              </div>
            )}
          </div>
        )}

        {task.reviewId && <SendToClientModal reviewId={task.reviewId} open={sendReview} onClose={() => setSendReview(false)} />}
        {task.reviewId && (
          <p className="text-sm"><Link href={`/revisiones/${task.reviewId}`} className="link font-medium">Abrir la revisión completa</Link></p>
        )}

        {notes.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">Notas del Baúl vinculadas</h3>
            <ul className="flex flex-wrap gap-2">
              {notes.map((n) => (
                <li key={n.id}><Link href={`/baul?nota=${n.id}`} className="link inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-sm dark:bg-white/10">📒 {n.title}</Link></li>
              ))}
            </ul>
          </div>
        )}

        <TaskChat taskId={task.id} meId={meId} />

        <div>
          <h3 className="mb-2 text-sm font-semibold">Historial</h3>
          <ul className="space-y-2 text-sm">
            {task.events.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                <span className="min-w-0">
                  <span className="font-medium">{e.userName}</span> <span className="text-zinc-600 dark:text-zinc-300">{(EVENT_LABEL[e.kind] ?? e.kind).toLowerCase()}</span>
                  {eventNote(e.kind, e.note) && <span className="block text-xs text-zinc-500">{eventNote(e.kind, e.note)}</span>}
                  <span className="block text-xs text-zinc-400">{formatMx(e.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Derecha: mini-panel */}
      <aside className="space-y-4 rounded-2xl bg-black/[0.03] p-4 text-sm dark:bg-white/[0.05]">
        <div>
          <p className="text-xs text-zinc-500">Fecha de asignación</p>
          <p>{formatMx(task.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Fecha de entrega</p>
          <p>{formatMx(task.dueAt)}</p>
          {task.status !== "PARA_REVISAR" && task.status !== "TERMINADA" && (
            <p className={cn("mt-1 flex items-center gap-1.5 font-semibold", rem.overdue ? "text-[#FF3B30]" : "text-[#007AFF]")}>
              <CalendarClock size={15} /> {rem.text}
            </p>
          )}
        </div>
        {isOps && (
          <button type="button" className="btn-outline w-full justify-center" onClick={copyLink}>
            {copied ? <><Check size={15} /> ¡Enlace copiado!</> : <><Link2 size={15} /> Copiar enlace de la tarea</>}
          </button>
        )}
        <p className="rounded-xl bg-[#FF9500]/10 px-3 py-2 text-[13px] italic text-[#B25E00] dark:text-[#FFB340]">“{phrase}”</p>

        <div>
          <p className="mb-1 text-xs text-zinc-500">Recursos</p>
          {task.resources.length === 0 ? (
            <p className="text-zinc-500">Sin recursos.</p>
          ) : (
            <ul className="space-y-1">
              {task.resources.map((r) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 break-all">
                    <ExternalLink size={13} className="shrink-0" /> {r.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canReady && (
          <button type="button" className="btn w-full justify-center" onClick={() => onMove("PARA_REVISAR")}>
            <Wand2 size={16} /> Lista
          </button>
        )}

        {!locked && targets.length > 0 && (
          <div>
            <label className="mb-1 block text-xs text-zinc-500" htmlFor="mover-a">Mover a</label>
            <select id="mover-a" className="input" value="" onChange={(e) => e.target.value && onMove(e.target.value as TaskStatus)}>
              <option value="">Elige la fase…</option>
              {targets.map((s) => <option key={s} value={s}>{STATUS_INFO[s].emoji} {STATUS_INFO[s].label}</option>)}
            </select>
          </div>
        )}

        {locked && <p className="text-xs text-zinc-500">Esta tarea ya fue aceptada. Solo puedes consultarla.</p>}

        {isOps && (
          <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-3 dark:border-white/10">
            <button type="button" className="btn-outline" onClick={onEdit}><Pencil size={14} /> Editar</button>
            <DeleteButton
              targetType="WORKTASK"
              targetId={task.id}
              isAdmin={role === "ADMIN" || scheduled}
              alreadyPending={false}
              onExecuted={() => { onClose(); router.refresh(); }}
              label="Solicitar eliminación"
            />
          </div>
        )}
      </aside>
    </div>
  );
}
