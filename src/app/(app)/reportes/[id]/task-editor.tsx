"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { saveTask } from "@/app/actions/reports";
import { cn } from "@/lib/utils";
import { Evidence } from "./evidence";
import { DeleteButton } from "@/components/delete-button";

type SaveState = "idle" | "saving" | "saved" | "error";
const DEBOUNCE_MS = 800;

export type TaskData = {
  id: string;
  sequentialNum: number;
  descriptionHtml: string;
  evidenceUrl: string | null;
  evidenceType: string | null;
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
}: {
  reportId: string;
  task: TaskData;
  number: number;
  editable: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  deletionPending: boolean;
  onDeleted: () => void;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(task.descriptionHtml);
  const dirty = useRef(false);

  async function flush() {
    if (!dirty.current) return;
    dirty.current = false;
    setState("saving");
    try {
      await saveTask(task.id, latest.current);
      setState(dirty.current ? "saving" : "saved");
    } catch {
      dirty.current = true;
      setState("error");
    }
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: task.descriptionHtml,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      latest.current = editor.getHTML();
      dirty.current = true;
      setState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DEBOUNCE_MS);
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

  const btn = (active: boolean) => cn("rounded-lg p-1.5 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:hover:bg-white/10", active && "bg-[#007AFF]/10 text-[#007AFF]");

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
        <span className="text-sm font-semibold tracking-tight">Actividad {number}</span>
        <span className="flex items-center gap-4">
          {editable && (
            <span className="text-xs text-zinc-500">
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
      {editable && editor && (
        <div className="flex gap-1 border-b border-black/5 px-3 py-1.5 dark:border-white/10">
          <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></button>
          <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
          <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
          <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
        </div>
      )}
      <EditorContent editor={editor} />
      <Evidence
        reportId={reportId}
        taskId={task.id}
        initial={{ evidenceUrl: task.evidenceUrl, evidenceType: task.evidenceType }}
        editable={editable}
      />
    </div>
  );
}
