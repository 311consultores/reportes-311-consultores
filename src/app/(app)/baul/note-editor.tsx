"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Bell, Link2, Palette, Pin, PinOff, Plus, Share2, Tag, Trash2, Users, Wand2, X } from "lucide-react";
import { leaveNote, setNoteFlags, setNoteLabels, shareNote, trashNote, updateNote } from "@/app/actions/notes";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";
import { RichTextEditor } from "@/components/rich-text";
import { NOTE_COLORS, noteBg, type NoteCard } from "@/lib/note-types";
import { toMxInput } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";

export type BaulData = {
  labels: { id: string; name: string }[];
  clients: { id: string; name: string; projects: { id: string; name: string }[] }[];
  tasks: { id: string; title: string; client: string }[];
  people: { id: string; name: string; photoUrl: string | null }[];
  isOps: boolean;
};

type Item = { key: number; text: string; done: boolean };
type Panel = null | "color" | "labels" | "reminder" | "link" | "share";
let keySeq = 1;

/** Ventana para ver y editar una nota: se guarda sola mientras escribes. */
export function NoteEditor({ note, data, onClose }: { note: NoteCard; data: BaulData; onClose: () => void }) {
  const router = useRouter();
  const editable = note.canEdit;
  const [title, setTitle] = useState(note.title);
  const [items, setItems] = useState<Item[]>(() => note.items.map((i) => ({ key: keySeq++, text: i.text, done: i.done })));
  const [color, setColor] = useState(note.color);
  const [labelIds, setLabelIds] = useState(note.labelIds);
  const [reminder, setReminder] = useState(note.reminderAt ? toMxInput(new Date(note.reminderAt)) : "");
  const [link, setLink] = useState({ clientId: note.link.clientId ?? "", projectId: note.link.projectId ?? "", taskId: note.link.taskId ?? "" });
  const [shares, setShares] = useState(note.shares);
  const [panel, setPanel] = useState<Panel>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState<string>();

  // Lo último escrito, para guardarlo aunque se cierre la ventana
  const latest = useRef({ title: note.title, html: note.bodyHtml, items: note.items.map((i) => ({ text: i.text, done: i.done })) });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);

  async function flush() {
    if (!dirty.current || !editable) return;
    dirty.current = false;
    setState("saving");
    const l = latest.current;
    const r = await updateNote(note.id, { title: l.title, ...(note.kind === "TEXT" ? { bodyHtml: l.html } : { items: l.items }) });
    setState(r.error ? "error" : dirty.current ? "saving" : "saved");
    if (r.error) setMsg(r.error);
  }
  function schedule() {
    dirty.current = true;
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }
  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const syncItems = (next: Item[]) => {
    setItems(next);
    latest.current.items = next.map((i) => ({ text: i.text, done: i.done }));
    schedule();
  };

  async function owner<T>(fn: () => Promise<T & { error?: string }>) {
    setMsg(undefined);
    const r = await fn();
    if (r.error) setMsg(r.error);
    else router.refresh();
    return r;
  }

  const project = data.clients.find((c) => c.id === link.clientId)?.projects ?? [];
  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));
  const tool = (active: boolean) => cn("rounded-lg p-2 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:hover:bg-white/10", active && "bg-[#007AFF]/10 text-[#007AFF]");

  return (
    <Modal open onClose={onClose} wide title={note.mine ? "Nota" : `Nota de ${note.ownerName}`} subtitle={editable ? undefined : "Solo puedes ver esta nota"}>
      <div className={cn("space-y-3 rounded-2xl p-4", noteBg(color))}>
        <input
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-zinc-400"
          placeholder="Título"
          aria-label="Título de la nota"
          maxLength={191}
          value={title}
          disabled={!editable}
          onChange={(e) => { setTitle(e.target.value); latest.current.title = e.target.value; schedule(); }}
        />
        {note.kind === "TEXT" ? (
          editable ? (
            <RichTextEditor initialHtml={note.bodyHtml} minHeight={160} onChange={(h) => { latest.current.html = h; schedule(); }} />
          ) : (
            <div className="text-sm [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: note.bodyHtml || "<p>Sin contenido.</p>" }} />
          )
        ) : (
          <ul className="space-y-1.5">
            {items.map((it, idx) => (
              <li key={it.key} className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#34C759]" checked={it.done} disabled={!editable} aria-label="Hecho" onChange={(e) => syncItems(items.map((x) => (x.key === it.key ? { ...x, done: e.target.checked } : x)))} />
                <input
                  className={cn("w-full bg-transparent py-1 text-sm outline-none", it.done && "text-zinc-400 line-through")}
                  value={it.text}
                  disabled={!editable}
                  placeholder="Elemento de la lista"
                  maxLength={500}
                  onChange={(e) => syncItems(items.map((x) => (x.key === it.key ? { ...x, text: e.target.value } : x)))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const next = [...items];
                      next.splice(idx + 1, 0, { key: keySeq++, text: "", done: false });
                      syncItems(next);
                    }
                  }}
                  autoFocus={idx === items.length - 1 && !it.text}
                />
                {editable && <button type="button" aria-label="Quitar elemento" onClick={() => syncItems(items.filter((x) => x.key !== it.key))} className="rounded-full p-1 text-zinc-500 hover:bg-black/5"><X size={14} /></button>}
              </li>
            ))}
            {editable && (
              <li>
                <button type="button" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-foreground" onClick={() => syncItems([...items, { key: keySeq++, text: "", done: false }])}>
                  <Plus size={14} /> Agregar elemento
                </button>
              </li>
            )}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {note.labelIds.length > 0 || labelIds.length > 0
            ? labelIds.map((id) => <span key={id} className="rounded-full bg-black/10 px-2.5 py-0.5 dark:bg-white/15">🏷 {data.labels.find((l) => l.id === id)?.name}</span>)
            : null}
          {reminder && <span className="rounded-full bg-black/10 px-2.5 py-0.5 dark:bg-white/15">⏰ {reminder.replace("T", " ")}</span>}
          {note.link.clientName && <span className="rounded-full bg-black/10 px-2.5 py-0.5 dark:bg-white/15">🏢 {note.link.clientName}{note.link.projectName ? ` · ${note.link.projectName}` : ""}</span>}
          {note.link.taskTitle && <span className="rounded-full bg-black/10 px-2.5 py-0.5 dark:bg-white/15">📋 {note.link.taskTitle}</span>}
          {!note.mine && <span className="inline-flex items-center gap-1.5 rounded-full bg-black/10 px-2.5 py-0.5 dark:bg-white/15"><Avatar name={note.ownerName} userId={note.ownerId} photoKey={note.ownerPhoto} size={18} /> Compartida por {note.ownerName}</span>}
        </div>
      </div>

      {note.mine && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-black/5 pb-2 dark:border-white/10">
          <button type="button" className={tool(panel === "color")} title="Color" aria-label="Color" onClick={() => toggle("color")}><Palette size={18} /></button>
          <button type="button" className={tool(panel === "labels")} title="Etiquetas" aria-label="Etiquetas" onClick={() => toggle("labels")}><Tag size={18} /></button>
          <button type="button" className={tool(panel === "reminder")} title="Recordatorio" aria-label="Recordatorio" onClick={() => toggle("reminder")}><Bell size={18} /></button>
          <button type="button" className={tool(panel === "link")} title="Vincular a un cliente, proyecto o tarea" aria-label="Vincular" onClick={() => toggle("link")}><Link2 size={18} /></button>
          <button type="button" className={tool(panel === "share")} title="Compartir" aria-label="Compartir" onClick={() => toggle("share")}><Share2 size={18} /></button>
          <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/15" />
          <button type="button" className={tool(note.pinned)} title={note.pinned ? "Quitar de fijadas" : "Fijar"} aria-label="Fijar" onClick={() => owner(() => setNoteFlags(note.id, { pinned: !note.pinned }))}>{note.pinned ? <PinOff size={18} /> : <Pin size={18} />}</button>
          <button type="button" className={tool(false)} title={note.archived ? "Sacar del archivo" : "Archivar"} aria-label="Archivar" onClick={async () => { const r = await owner(() => setNoteFlags(note.id, { archived: !note.archived })); if (!r.error) onClose(); }}>{note.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}</button>
          <button type="button" className={cn(tool(false), "text-[#FF3B30]")} title="A la papelera" aria-label="A la papelera" onClick={async () => { const r = await owner(() => trashNote(note.id)); if (!r.error) onClose(); }}><Trash2 size={18} /></button>
          {data.isOps && <button type="button" className="btn-outline ml-auto px-3 py-1.5 text-xs" onClick={() => router.push(`/tareas?nota=${note.id}`)}><Wand2 size={14} /> Convertir en tarea</button>}
        </div>
      )}
      {!note.mine && (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/5 pb-2 dark:border-white/10">
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={async () => { const r = await owner(() => leaveNote(note.id)); if (!r.error) onClose(); }}>Dejar de ver esta nota</button>
          {data.isOps && <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => router.push(`/tareas?nota=${note.id}`)}><Wand2 size={14} /> Convertir en tarea</button>}
        </div>
      )}

      {panel === "color" && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Colores">
          {NOTE_COLORS.map((c) => (
            <button key={c.id} type="button" title={c.label} aria-label={c.label} onClick={() => { setColor(c.id); void owner(() => updateNote(note.id, { color: c.id })); }} className={cn("h-8 w-8 rounded-full border border-black/15 transition-transform hover:scale-110", color === c.id && "ring-2 ring-[#007AFF] ring-offset-2")} style={{ backgroundColor: c.swatch }} />
          ))}
        </div>
      )}
      {panel === "labels" && (
        <div className="space-y-1.5">
          {data.labels.length === 0 && <p className="text-sm text-zinc-500">Aún no tienes etiquetas. Créalas en el panel lateral del Baúl.</p>}
          {data.labels.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#007AFF]" checked={labelIds.includes(l.id)} onChange={(e) => { const next = e.target.checked ? [...labelIds, l.id] : labelIds.filter((x) => x !== l.id); setLabelIds(next); void owner(() => setNoteLabels(note.id, next)); }} />
              {l.name}
            </label>
          ))}
        </div>
      )}
      {panel === "reminder" && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="datetime-local" className="input !w-auto" aria-label="Fecha y hora del recordatorio" value={reminder} onChange={(e) => setReminder(e.target.value)} />
          <button type="button" className="btn px-3 py-1.5 text-sm" disabled={!reminder} onClick={() => owner(() => updateNote(note.id, { reminder }))}>Guardar recordatorio</button>
          {reminder && <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={() => { setReminder(""); void owner(() => updateNote(note.id, { reminder: null })); }}>Quitar</button>}
          <p className="w-full text-xs text-zinc-500">Te avisamos en la campanita, en el navegador y por correo a esa hora (el aviso puede tardar hasta una hora).</p>
        </div>
      )}
      {panel === "link" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="nl-client">Cliente</label>
            <select id="nl-client" className="input" value={link.clientId} onChange={(e) => { const next = { clientId: e.target.value, projectId: "", taskId: link.taskId }; setLink(next); void owner(() => updateNote(note.id, { clientId: next.clientId || null, projectId: null, taskId: next.taskId || null })); }}>
              <option value="">—</option>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nl-project">Proyecto</label>
            <select id="nl-project" className="input" disabled={!link.clientId} value={link.projectId} onChange={(e) => { const next = { ...link, projectId: e.target.value }; setLink(next); void owner(() => updateNote(note.id, { clientId: next.clientId || null, projectId: next.projectId || null, taskId: next.taskId || null })); }}>
              <option value="">—</option>
              {project.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nl-task">Tarea</label>
            <select id="nl-task" className="input" value={link.taskId} onChange={(e) => { const next = { ...link, taskId: e.target.value }; setLink(next); void owner(() => updateNote(note.id, { clientId: next.clientId || null, projectId: next.projectId || null, taskId: next.taskId || null })); }}>
              <option value="">—</option>
              {data.tasks.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.client}</option>)}
            </select>
          </div>
        </div>
      )}
      {panel === "share" && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Users size={15} /> Compartir con</p>
          <ul className="max-h-52 space-y-1 overflow-y-auto">
            {data.people.map((p) => {
              const s = shares.find((x) => x.userId === p.id);
              return (
                <li key={p.id} className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[#007AFF]" checked={!!s} aria-label={`Compartir con ${p.name}`} onChange={(e) => setShares((cur) => (e.target.checked ? [...cur, { userId: p.id, name: p.name, photoUrl: p.photoUrl, canEdit: false }] : cur.filter((x) => x.userId !== p.id)))} />
                  <Avatar name={p.name} userId={p.id} photoKey={p.photoUrl} size={24} />
                  <span className="flex-1">{p.name}</span>
                  {s && (
                    <select className="input !w-auto !py-1 text-xs" aria-label={`Permiso de ${p.name}`} value={s.canEdit ? "edit" : "view"} onChange={(e) => setShares((cur) => cur.map((x) => (x.userId === p.id ? { ...x, canEdit: e.target.value === "edit" } : x)))}>
                      <option value="view">Solo ver</option>
                      <option value="edit">Puede editar</option>
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn px-4 py-1.5 text-sm" onClick={async () => { const r = await owner(() => shareNote(note.id, shares.map((s) => ({ userId: s.userId, canEdit: s.canEdit })))); if (!r.error) setMsg("Se guardó con quién compartes la nota."); }}>Guardar</button>
          <p className="text-xs text-zinc-500">Quien puede editar cambia el contenido, pero solo tú puedes cambiar con quién se comparte o eliminarla.</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span aria-live="polite">{state === "saving" ? "Guardando…" : state === "saved" ? "Guardado" : state === "error" ? <span className="text-destructive">Error al guardar</span> : " "}</span>
        {msg && <span className="text-[#B25E00] dark:text-[#FFB340]">{msg}</span>}
        <button type="button" className="btn-outline px-4 py-1.5 text-sm" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}
