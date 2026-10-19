"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

const btn = (active: boolean) =>
  cn("rounded-lg p-1.5 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:hover:bg-white/10", active && "bg-[#007AFF]/10 text-[#007AFF]");

/**
 * Editor de texto con formato (negritas, cursiva, viñetas y numeración), el mismo que usan las actividades de los reportes.
 * Envía el HTML en un campo oculto con el nombre indicado; con onChange también se puede leer desde el componente padre.
 */
export function RichTextEditor({ name, initialHtml = "", onChange, minHeight = 120 }: { name?: string; initialHtml?: string; onChange?: (html: string) => void; minHeight?: number }) {
  const [html, setHtml] = useState(initialHtml);
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const h = editor.isEmpty ? "" : editor.getHTML();
      setHtml(h);
      onChange?.(h);
    },
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5">
      {name && <input type="hidden" name={name} value={html} />}
      {editor && (
        <div className="flex gap-1 border-b border-black/5 px-3 py-1.5 dark:border-white/10">
          <button type="button" aria-label="Negritas" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></button>
          <button type="button" aria-label="Cursiva" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
          <button type="button" aria-label="Lista con viñetas" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
          <button type="button" aria-label="Lista numerada" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
        </div>
      )}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/** Muestra HTML del editor sin permitir edición (se renderiza con Tiptap, no con HTML crudo). */
export function RichTextView({ html }: { html: string }) {
  const editor = useEditor({ extensions: [StarterKit], content: html, editable: false, immediatelyRender: false });
  useEffect(() => {
    editor?.commands.setContent(html);
  }, [editor, html]);
  if (!html) return <p className="text-sm text-zinc-500">Sin descripción.</p>;
  return <EditorContent editor={editor} className="[&_.tiptap]:min-h-0 [&_.tiptap]:px-0 [&_.tiptap]:py-0" />;
}
