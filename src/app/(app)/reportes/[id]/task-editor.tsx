"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, ChevronDown, Italic, List, ListOrdered } from "lucide-react";
import { saveTask } from "@/app/actions/reports";
import { cn } from "@/lib/utils";
import { Evidence, type EvidenceItem } from "./evidence";
import { DeleteButton } from "@/components/delete-button";

type SaveState = "idle" | "saving" | "saved" | "error";
const DEBOUNCE_MS = 800;

export type TaskData = {
  id: string;
  sequentialNum: number;
  title: string | null;
  descriptionHtml: string;
  evidences: EvidenceItem[];
};

export function TaskEditor({
  reportId,
  task,
  number,
  editable,
  canDelete,
  isAdmin,
  deletionPending,
  onDeleted,
  open,
  onToggle,
}: {
  reportId: string;
  task: TaskData;
  number: number;
  editable: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  deletionPending: boolean;
  onDeleted: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [title, setTitle] = useState(task.title ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestHtml = useRef(task.descriptionHtml);
  const latestTitle = useRef(task.title ?? "");
  const dirty = useRef(false);

  async function flush() {
    if (!dirty.current) return;
    dirty.current = false;
    setState("saving");
    try {
      await saveTask(task.id, latestHtml.current, latestTitle.current);
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

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            size={18}
            className={cn("shrink-0 text-zinc-500 transition-transform duration-200 ease-out", !open && "-rotate-90")}
          />
          <span className="truncate text-sm font-semibold tracking-tight">{heading}</span>
        </button>
        <span className="flex shrink-0 items-center gap-4">
          {editable && (
            <span className="text-xs text-muted-foreground">
              {state === "saving" && "Guardando…"}
              {state === "saved" && "Guardado"}
              {state === "error" && <span className="text-destructive">Error al guardar, reintentando al editar</span>}
            </span>
          )}
          {canDelete && (
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
        <div className="border-t border-black/5 px-4 py-3 dark:border-white/10">
          <label className="label" htmlFor={`title-${task.id}`}>Título de la actividad (opcional)</label>
          {editable ? (
            <input
              id={`title-${task.id}`}
              className="input"
              maxLength={191}
              value={title}
              placeholder="Ej. Reunión de arranque con el cliente"
              onChange={(e) => {
                setTitle(e.target.value);
                latestTitle.current = e.target.value;
                schedule();
              }}
            />
          ) : (
            <p className="text-sm">{title || "—"}</p>
          )}
        </div>
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
