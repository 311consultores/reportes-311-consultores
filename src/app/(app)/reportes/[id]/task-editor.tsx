"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, ChevronDown, ChevronUp, GripVertical, Italic, List, ListOrdered, Pencil, Trash2 } from "lucide-react";
import { deleteTaskDirect, saveTask } from "@/app/actions/reports";
import { useDialogs } from "@/components/dialogs";
import { cn } from "@/lib/utils";
import { formatExecuted } from "@/lib/task-date";
import { Evidence, type EvidenceItem } from "./evidence";
import { DeleteButton } from "@/components/delete-button";

type SaveState = "idle" | "saving" | "saved" | "error";
const DEBOUNCE_MS = 1500; // espera a que se deje de escribir: menos peticiones al servidor

export type TaskData = {
  id: string;
  sequentialNum: number;
  title: string | null;
  executedAt: string | null;
  descriptionHtml: string;
  evidences: EvidenceItem[];
};

export function TaskEditor({
  reportId,
  task,
  number,
  editable,
  canDelete,
  directDelete,
  isAdmin,
  deletionPending,
  onDeleted,
  open,
  onToggle,
  reorder,
}: {
  reportId: string;
  task: TaskData;
  number: number;
  editable: boolean;
  canDelete: boolean;
  directDelete: boolean;
  isAdmin: boolean;
  deletionPending: boolean;
  onDeleted: () => void;
  open: boolean;
  onToggle: () => void;
  /** Controles para reordenar (solo en reportes editables): asa de arrastre y flechas. */
  reorder?: { onGripDown: (e: React.PointerEvent) => void; up: () => void; down: () => void; isFirst: boolean; isLast: boolean };
}) {
  const { confirm } = useDialogs();
  const [state, setState] = useState<SaveState>("idle");
  const [title, setTitle] = useState(task.title ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestHtml = useRef(task.descriptionHtml);
  const latestTitle = useRef(task.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [withDate, setWithDate] = useState(!!task.executedAt);
  const [execDate, setExecDate] = useState(task.executedAt?.slice(0, 10) ?? "");
  const [execTime, setExecTime] = useState(task.executedAt?.slice(11, 16) ?? "");
  const latestWhen = useRef<string | null>(task.executedAt);
  const dirty = useRef(false);
  const lastSent = useRef(`${task.title ?? ""}\u0000${task.descriptionHtml}\u0000${task.executedAt ?? ""}`);

  async function flush() {
    if (!dirty.current) return;
    dirty.current = false;
    const payload = `${latestTitle.current}\u0000${latestHtml.current}\u0000${latestWhen.current ?? ""}`;
    if (payload === lastSent.current) {
      setState("saved"); // el texto volvió a ser el ya guardado: no hace falta pedirle nada al servidor
      return;
    }
    setState("saving");
    try {
      await saveTask(task.id, latestHtml.current, latestTitle.current, latestWhen.current);
      lastSent.current = payload;
      setState(dirty.current ? "saving" : "saved");
    } catch {
      dirty.current = true;
      setState("error");
    }
  }

  function schedule() {
    dirty.current = true;
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: task.descriptionHtml,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      latestHtml.current = editor.getHTML();
      schedule();
    },
  });

  // Si el reporte deja de ser editable (p. ej. se marcó como terminado), el texto se bloquea sin recargar
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // Guardar cambios pendientes al cerrar la pestaña o desmontar
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      clearTimeout(timer.current);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const btn = (active: boolean) =>
    cn(
      "rounded-lg p-1.5 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:hover:bg-white/10",
      active && "bg-[#007AFF]/10 text-[#007AFF]",
    );

  const heading = title.trim() ? `Actividad ${number} — ${title.trim()}` : `Actividad ${number}`;
  const executedLabel = formatExecuted(withDate && execDate && execTime ? `${execDate} ${execTime}` : null);

  /** Guarda fecha y hora juntas: solo cuentan cuando la casilla está marcada y ambas están completas. */
  function updateWhen(checked: boolean, d: string, t: string) {
    latestWhen.current = checked && d && t ? `${d} ${t}` : null;
    schedule();
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {reorder && (
            <span className="flex shrink-0 items-center gap-0.5 text-zinc-400">
              <button
                type="button"
                aria-label="Arrastrar para reordenar la actividad"
                title="Arrastra para cambiar el orden"
                onPointerDown={reorder.onGripDown}
                className="cursor-grab touch-none select-none rounded-lg p-1 hover:bg-black/5 active:cursor-grabbing dark:hover:bg-white/10"
              >
                <GripVertical size={18} />
              </button>
              <span className="flex flex-col">
                <button type="button" aria-label="Subir la actividad" disabled={reorder.isFirst} onClick={reorder.up} className="rounded p-0.5 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10"><ChevronUp size={13} /></button>
                <button type="button" aria-label="Bajar la actividad" disabled={reorder.isLast} onClick={reorder.down} className="rounded p-0.5 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10"><ChevronDown size={13} /></button>
              </span>
            </span>
          )}
          <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? "Contraer actividad" : "Abrir actividad"} className="shrink-0">
            <ChevronDown size={18} className={cn("text-zinc-500 transition-transform duration-200 ease-out", !open && "-rotate-90")} />
          </button>
          {editingTitle ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-sm font-semibold tracking-tight">Actividad {number} —</span>
              <input
                autoFocus
                className="input !py-1 text-sm"
                maxLength={191}
                value={title}
                placeholder="Título (ej. Reunión de arranque con el cliente)"
                aria-label="Título de la actividad"
                onChange={(e) => {
                  setTitle(e.target.value);
                  latestTitle.current = e.target.value;
                  schedule();
                }}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && setEditingTitle(false)}
              />
            </span>
          ) : (
            <span className="min-w-0">
              <button type="button" onClick={onToggle} className="block max-w-full truncate text-left text-sm font-semibold tracking-tight">{heading}</button>
              {executedLabel && <span className="block truncate text-xs text-zinc-500">{executedLabel}</span>}
            </span>
          )}
          {editable && !editingTitle && (
            <button
              type="button"
              aria-label="Editar título de la actividad"
              title="Agregar o editar el título"
              onClick={() => setEditingTitle(true)}
              className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:hover:bg-white/10"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-4">
          {editable && (
            <span className="text-xs text-muted-foreground">
              {state === "saving" && "Guardando…"}
              {state === "saved" && "Guardado"}
              {state === "error" && <span className="text-destructive">Error al guardar, reintentando al editar</span>}
            </span>
          )}
          {canDelete && directDelete && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#FF3B30] transition-all duration-200 ease-out hover:opacity-70 active:scale-[0.98]"
              onClick={async () => {
                if (!(await confirm({ title: "Eliminar actividad", message: "La actividad y sus evidencias se eliminan. Esta acción no se puede deshacer.", confirmLabel: "Eliminar", danger: true }))) return;
                const r = await deleteTaskDirect(task.id);
                if (!r.error) onDeleted();
              }}
            >
              <Trash2 size={13} /> Eliminar
            </button>
          )}
          {canDelete && !directDelete && (
            <DeleteButton
              targetType="TASK"
              targetId={task.id}
              isAdmin={isAdmin}
              alreadyPending={deletionPending}
              onExecuted={onDeleted}
              label="Solicitar eliminación"
            />
          )}
        </span>
      </div>

      {/* Se mantiene montado aunque esté contraído, para no perder el autosave */}
      <div className={cn(!open && "hidden")}>
        {editable && (
          <div className="space-y-3 border-t border-black/5 px-4 py-3 dark:border-white/10">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#007AFF]"
                checked={withDate}
                onChange={(e) => {
                  setWithDate(e.target.checked);
                  updateWhen(e.target.checked, execDate, execTime);
                }}
              />
              Indicar fecha y hora de ejecución
            </label>
            {withDate && (
              <div className="grid max-w-sm gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor={`fecha-${task.id}`}>Fecha</label>
                  <input id={`fecha-${task.id}`} type="date" className="input" value={execDate} onChange={(e) => { setExecDate(e.target.value); updateWhen(true, e.target.value, execTime); }} />
                </div>
                <div>
                  <label className="label" htmlFor={`hora-${task.id}`}>Hora</label>
                  <input id={`hora-${task.id}`} type="time" className="input" value={execTime} onChange={(e) => { setExecTime(e.target.value); updateWhen(true, execDate, e.target.value); }} />
                </div>
              </div>
            )}
          </div>
        )}
        {editable && editor && (
          <div className="flex gap-1 border-y border-black/5 px-3 py-1.5 dark:border-white/10">
            <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></button>
            <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
            <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
            <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
          </div>
        )}
        <EditorContent editor={editor} />
        <Evidence reportId={reportId} taskId={task.id} initial={task.evidences} editable={editable} />
      </div>
    </div>
  );
}
