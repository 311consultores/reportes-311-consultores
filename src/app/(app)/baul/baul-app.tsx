"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Bell, ListChecks, Pin, Plus, Search, Share2, StickyNote, Tag, Trash2, Undo2, Users, X } from "lucide-react";
import { createLabel, createNote, deleteLabel, deleteNoteForever, emptyTrash, reorderNotes, restoreNote, setNoteFlags, trashNote, updateNote } from "@/app/actions/notes";
import { useDialogs } from "@/components/dialogs";
import { RichTextEditor } from "@/components/rich-text";
import { NOTE_COLORS, noteBg, TRASH_DAYS, type NoteCard } from "@/lib/note-types";
import { cn } from "@/lib/utils";
import { NoteEditor, type BaulData } from "./note-editor";

type Section = "notas" | "compartidas" | "archivo" | "papelera" | `label:${string}`;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");

/** Baúl: notas privadas estilo Google Keep, con etiquetas, colores, recordatorios y notas compartidas. */
export function BaulApp({ notes, labels, clients, tasks, people, isOps, openId }: BaulData & { notes: NoteCard[]; openId?: string }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [section, setSection] = useState<Section>("notas");
  const [q, setQ] = useState("");
  const [openNote, setOpenNote] = useState<string | null>(openId && notes.some((n) => n.id === openId) ? openId : null);
  const [prevOpenId, setPrevOpenId] = useState(openId);
  const [newLabel, setNewLabel] = useState("");
  const [dragId, setDragId] = useState<string>();
  const data: BaulData = { labels, clients, tasks, people, isOps };

  // Si se llega desde un aviso (?nota=…) estando ya en el Baúl, se abre esa nota
  if (openId !== prevOpenId) {
    setPrevOpenId(openId);
    if (openId && notes.some((n) => n.id === openId)) setOpenNote(openId);
  }

  const counts = useMemo(() => ({
    notas: notes.filter((n) => n.mine && !n.archived && !n.trashedAt).length,
    compartidas: notes.filter((n) => !n.mine).length,
    archivo: notes.filter((n) => n.mine && n.archived && !n.trashedAt).length,
    papelera: notes.filter((n) => n.mine && n.trashedAt).length,
  }), [notes]);

  const nq = norm(q.trim());
  const visible = useMemo(() => {
    const base = notes.filter((n) => {
      if (nq) return !n.trashedAt && norm([n.title, plain(n.bodyHtml), ...n.items.map((i) => i.text), ...n.labelIds.map((id) => labels.find((l) => l.id === id)?.name ?? "")].join(" ")).includes(nq); // la búsqueda recorre todas las notas
      if (section === "notas") return n.mine && !n.archived && !n.trashedAt;
      if (section === "compartidas") return !n.mine;
      if (section === "archivo") return n.mine && n.archived && !n.trashedAt;
      if (section === "papelera") return n.mine && !!n.trashedAt;
      return n.mine && !n.trashedAt && n.labelIds.includes(section.slice(6));
    });
    return base.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.position - b.position);
  }, [notes, section, nq, labels]);

  const pinned = visible.filter((n) => n.pinned);
  const others = visible.filter((n) => !n.pinned);
  const current = notes.find((n) => n.id === openNote);

  async function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const a = visible.find((n) => n.id === dragId);
    const b = visible.find((n) => n.id === targetId);
    if (!a?.mine || !b?.mine || a.pinned !== b.pinned) return;
    const ids = visible.filter((n) => n.mine && n.pinned === a.pinned).map((n) => n.id).filter((i) => i !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(undefined);
    await reorderNotes(ids);
    router.refresh();
  }

  const navBtn = (id: Section, label: string, icon: React.ReactNode, count?: number) => (
    <button key={id} type="button" onClick={() => { setSection(id); setQ(""); }} aria-current={section === id && !nq} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all duration-200 ease-out", section === id && !nq ? "bg-[#007AFF]/10 text-[#007AFF]" : "hover:bg-black/5 dark:hover:bg-white/10")}>
      {icon} <span className="flex-1 truncate">{label}</span>{count ? <span className="text-xs text-zinc-500">{count}</span> : null}
    </button>
  );

  const grid = (list: NoteCard[]) => (
    <div className="columns-1 gap-3 sm:columns-2 xl:columns-3 2xl:columns-4">
      {list.map((n) => (
        <Card
          key={n.id}
          note={n}
          labels={labels}
          draggable={n.mine && !nq && section !== "papelera" && !!n.id}
          onDragStart={() => setDragId(n.id)}
          onDragEnd={() => setDragId(undefined)}
          onDropOn={() => void dropOn(n.id)}
          onOpen={() => setOpenNote(n.id)}
          onChanged={() => router.refresh()}
          confirmDelete={() => confirm({ title: "Eliminar para siempre", message: "La nota se borra definitivamente. Esta acción no se puede deshacer.", confirmLabel: "Eliminar", danger: true })}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title mr-auto">Baúl</h1>
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input className="input pl-10 pr-9" placeholder="Buscar en tus notas…" aria-label="Buscar en el Baúl" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-black/5"><X size={14} /></button>}
        </div>
      </div>
      <p className="rounded-xl bg-[#FF9500]/10 px-4 py-2 text-xs text-[#B25E00] dark:text-[#FFB340]">🔒 Tus notas son privadas: solo las ves tú y las personas con quienes las compartas. <strong>No guardes contraseñas</strong> en el Baúl.</p>

      <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
        <nav className="space-y-1" aria-label="Secciones del Baúl">
          {navBtn("notas", "Mis notas", <StickyNote size={16} />, counts.notas)}
          {navBtn("compartidas", "Compartidas conmigo", <Users size={16} />, counts.compartidas)}
          {navBtn("archivo", "Archivadas", <Archive size={16} />, counts.archivo)}
          {navBtn("papelera", "Papelera", <Trash2 size={16} />, counts.papelera)}
          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Etiquetas</p>
          {labels.map((l) => (
            <div key={l.id} className="group flex items-center">
              <div className="min-w-0 flex-1">{navBtn(`label:${l.id}`, l.name, <Tag size={16} />, notes.filter((n) => n.mine && !n.trashedAt && n.labelIds.includes(l.id)).length)}</div>
              <button
                type="button"
                aria-label={`Eliminar la etiqueta ${l.name}`}
                className="rounded-full p-1 text-zinc-400 opacity-0 transition-opacity hover:text-[#FF3B30] focus:opacity-100 group-hover:opacity-100"
                onClick={async () => { if (await confirm({ title: "Eliminar etiqueta", message: `Se quita «${l.name}» de todas tus notas (las notas no se borran).`, confirmLabel: "Eliminar", danger: true })) { await deleteLabel(l.id); if (section === `label:${l.id}`) setSection("notas"); router.refresh(); } }}
              ><X size={13} /></button>
            </div>
          ))}
          <form className="flex gap-1.5 px-1 pt-1" onSubmit={async (e) => { e.preventDefault(); if (!newLabel.trim()) return; await createLabel(newLabel); setNewLabel(""); router.refresh(); }}>
            <input className="input !py-1.5 text-sm" placeholder="Nueva etiqueta" aria-label="Nueva etiqueta" maxLength={60} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <button type="submit" className="btn-outline px-2.5" aria-label="Crear etiqueta"><Plus size={14} /></button>
          </form>
        </nav>

        <div className="min-w-0 space-y-5">
          {section === "notas" && !nq && <Composer labels={labels} onCreated={() => router.refresh()} />}
          {section === "papelera" && !nq && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              <span>Las notas en la papelera se borran para siempre a los {TRASH_DAYS} días.</span>
              {counts.papelera > 0 && <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={async () => { if (await confirm({ title: "Vaciar la papelera", message: "Se borran para siempre todas las notas de la papelera.", confirmLabel: "Vaciar", danger: true })) { await emptyTrash(); router.refresh(); } }}>Vaciar papelera</button>}
            </div>
          )}
          {nq && <p className="meta">Resultados en todas tus notas: {visible.length}</p>}

          {pinned.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Fijadas</h2>
              {grid(pinned)}
            </section>
          )}
          {others.length > 0 && (
            <section className="space-y-2">
              {pinned.length > 0 && <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Otras</h2>}
              {grid(others)}
            </section>
          )}
          {visible.length === 0 && (
            <p className="card meta text-center">
              {nq ? "No hay notas que coincidan con la búsqueda." : section === "notas" ? "Aún no tienes notas. ¡Escribe la primera arriba!" : section === "compartidas" ? "Nadie ha compartido notas contigo todavía." : section === "papelera" ? "La papelera está vacía." : "No hay notas aquí."}
            </p>
          )}
        </div>
      </div>

      {current && <NoteEditor key={current.id} note={current} data={data} onClose={() => { setOpenNote(null); router.refresh(); if (openId) router.replace("/baul", { scroll: false }); }} />}
    </div>
  );
}

/** Tarjeta de una nota (clic para abrirla; acciones rápidas al pasar el ratón). */
function Card({ note: n, labels, draggable, onDragStart, onDragEnd, onDropOn, onOpen, onChanged, confirmDelete }: {
  note: NoteCard; labels: { id: string; name: string }[]; draggable: boolean; onDragStart: () => void; onDragEnd: () => void; onDropOn: () => void;
  onOpen: () => void; onChanged: () => void; confirmDelete: () => Promise<boolean>;
}) {
  const trashed = !!n.trashedAt;
  const act = (fn: () => Promise<unknown>) => async (e: React.MouseEvent) => { e.stopPropagation(); await fn(); onChanged(); };
  const quick = "rounded-full p-1.5 text-zinc-600 transition-all duration-200 ease-out hover:bg-black/10 active:scale-[0.95] dark:text-zinc-300 dark:hover:bg-white/15";
  return (
    <article
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", n.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (draggable) e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); onDropOn(); }}
      onClick={onOpen}
      className={cn("group relative mb-3 cursor-pointer break-inside-avoid rounded-2xl border border-black/10 p-4 shadow-sm transition-all duration-200 ease-out hover:shadow-md dark:border-white/10", noteBg(n.color))}
    >
      {n.pinned && <Pin size={13} className="absolute right-3 top-3 text-zinc-500" aria-label="Fijada" />}
      {n.title && <h3 className="mb-1 pr-5 font-semibold leading-snug">{n.title}</h3>}
      {n.kind === "TEXT" ? (
        n.bodyHtml && <div className="line-clamp-[10] text-sm [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: n.bodyHtml }} />
      ) : (
        <ul className="space-y-1 text-sm">
          {n.items.slice(0, 8).map((i, idx) => (
            <li key={`${i.id}-${idx}`} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#34C759]"
                checked={i.done}
                disabled={!n.canEdit || trashed}
                aria-label={i.text}
                onClick={(e) => e.stopPropagation()}
                onChange={async (e) => { await updateNote(n.id, { items: n.items.map((x, j) => ({ text: x.text, done: j === idx ? e.target.checked : x.done })) }); onChanged(); }}
              />
              <span className={cn(i.done && "text-zinc-400 line-through")}>{i.text}</span>
            </li>
          ))}
          {n.items.length > 8 && <li className="text-xs text-zinc-500">+ {n.items.length - 8} más…</li>}
        </ul>
      )}
      {!n.title && !n.bodyHtml && n.items.length === 0 && <p className="text-sm text-zinc-400">Nota vacía</p>}

      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        {n.labelIds.map((id) => <span key={id} className="rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/15">{labels.find((l) => l.id === id)?.name}</span>)}
        {n.reminderAt && <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/15"><Bell size={10} /> {new Date(n.reminderAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span>}
        {n.link.clientName && <span className="rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/15">🏢 {n.link.clientName}</span>}
        {n.link.taskTitle && <span className="rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/15">📋 {n.link.taskTitle}</span>}
        {!n.mine && <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/15"><Share2 size={10} /> de {n.ownerName}{n.canEdit ? "" : " · solo ver"}</span>}
        {n.mine && n.shares.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/15"><Users size={10} /> {n.shares.length}</span>}
      </div>

      {n.mine && (
        <div className="mt-2 flex items-center justify-end gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
          {trashed ? (
            <>
              <button type="button" className={quick} title="Restaurar" aria-label="Restaurar" onClick={act(() => restoreNote(n.id))}><Undo2 size={15} /></button>
              <button type="button" className={cn(quick, "text-[#FF3B30]")} title="Eliminar para siempre" aria-label="Eliminar para siempre" onClick={async (e) => { e.stopPropagation(); if (await confirmDelete()) { await deleteNoteForever(n.id); onChanged(); } }}><Trash2 size={15} /></button>
            </>
          ) : (
            <>
              <button type="button" className={quick} title={n.pinned ? "Quitar de fijadas" : "Fijar"} aria-label="Fijar" onClick={act(() => setNoteFlags(n.id, { pinned: !n.pinned }))}><Pin size={15} /></button>
              <button type="button" className={quick} title={n.archived ? "Sacar del archivo" : "Archivar"} aria-label="Archivar" onClick={act(() => setNoteFlags(n.id, { archived: !n.archived }))}><Archive size={15} /></button>
              <button type="button" className={cn(quick, "text-[#FF3B30]")} title="A la papelera" aria-label="A la papelera" onClick={act(() => trashNote(n.id))}><Trash2 size={15} /></button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Cuadro para escribir una nota nueva: texto con formato o lista de verificación. */
function Composer({ labels, onCreated }: { labels: { id: string; name: string }[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"TEXT" | "CHECKLIST">("TEXT");
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [items, setItems] = useState<string[]>([""]);
  const [color, setColor] = useState("white");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [rk, setRk] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function reset() {
    setOpen(false); setKind("TEXT"); setTitle(""); setHtml(""); setItems([""]); setColor("white"); setLabelIds([]); setRk((k) => k + 1); setError(undefined);
  }
  async function save() {
    const empty = !title.trim() && (kind === "TEXT" ? !html.replace(/<[^>]+>/g, "").trim() : items.every((i) => !i.trim()));
    if (empty) return reset();
    setBusy(true);
    const r = await createNote({ kind, title, bodyHtml: html, items: items.map((text) => ({ text, done: false })), color, labelIds });
    setBusy(false);
    if (r.error) return setError(r.error);
    reset();
    onCreated();
  }

  if (!open) {
    return (
      <div className="card mx-auto flex max-w-xl items-center gap-2 p-3">
        <button type="button" className="flex-1 px-2 py-1 text-left text-sm text-zinc-500" onClick={() => setOpen(true)}>Escribe una nota…</button>
        <button type="button" className="rounded-full p-2 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10" title="Nueva lista" aria-label="Nueva lista" onClick={() => { setKind("CHECKLIST"); setOpen(true); }}><ListChecks size={18} /></button>
      </div>
    );
  }
  return (
    <div className={cn("mx-auto max-w-xl space-y-3 rounded-2xl border border-black/10 p-4 shadow-md dark:border-white/10", noteBg(color))}>
      <input className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-zinc-400" placeholder="Título" aria-label="Título de la nota" maxLength={191} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      {kind === "TEXT" ? (
        <RichTextEditor key={rk} onChange={setHtml} minHeight={90} />
      ) : (
        <ul className="space-y-1.5">
          {items.map((t, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="h-4 w-4 shrink-0 rounded border border-zinc-400" />
              <input
                className="w-full bg-transparent py-1 text-sm outline-none"
                placeholder="Elemento de la lista"
                value={t}
                maxLength={500}
                autoFocus={i === items.length - 1 && i > 0}
                onChange={(e) => setItems((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setItems((cur) => { const n = [...cur]; n.splice(i + 1, 0, ""); return n; }); } }}
              />
              {items.length > 1 && <button type="button" aria-label="Quitar elemento" onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))} className="rounded-full p-1 text-zinc-500 hover:bg-black/5"><X size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Colores">
          {NOTE_COLORS.map((c) => (
            <button key={c.id} type="button" title={c.label} aria-label={c.label} onClick={() => setColor(c.id)} className={cn("h-6 w-6 rounded-full border border-black/15", color === c.id && "ring-2 ring-[#007AFF] ring-offset-1")} style={{ backgroundColor: c.swatch }} />
          ))}
        </div>
        {labels.length > 0 && (
          <select className="input !w-auto !py-1 text-xs" aria-label="Agregar etiqueta" value="" onChange={(e) => e.target.value && setLabelIds((cur) => [...new Set([...cur, e.target.value])])}>
            <option value="">+ Etiqueta</option>
            {labels.filter((l) => !labelIds.includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {labelIds.map((id) => <span key={id} className="rounded-full bg-black/10 px-2 py-0.5 text-[11px]">{labels.find((l) => l.id === id)?.name}</span>)}
        <button type="button" className="btn-outline ml-auto px-3 py-1.5 text-xs" onClick={() => setKind((k) => (k === "TEXT" ? "CHECKLIST" : "TEXT"))}><ListChecks size={14} /> {kind === "TEXT" ? "Convertir en lista" : "Convertir en texto"}</button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-outline px-4 py-1.5 text-sm" onClick={reset}>Cancelar</button>
        <button type="button" className="btn px-4 py-1.5 text-sm" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar nota"}</button>
      </div>
    </div>
  );
}
