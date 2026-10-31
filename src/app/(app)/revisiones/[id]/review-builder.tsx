"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, GripVertical, Plus, Send, Trash2, Upload, X } from "lucide-react";
import { addSlide, deleteAsset, deleteSlide, moveAsset, publishReview, reorderSlides, saveSlide, updateReviewMeta } from "@/app/actions/reviews";
import { DateInput } from "@/components/date-input";
import { useDialogs } from "@/components/dialogs";
import { EmailPills } from "@/components/email-pills";
import { ReviewThumb } from "@/components/review-thumb";
import { ART_KIND_LABEL, artKind, CHANNELS, MAX_ASSETS, MAX_COPY } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import type { AssetData, ReviewData, SlideData } from "./types";

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const mimeOf = (f: File) => f.type || MIME_BY_EXT[f.name.split(".").pop()?.toLowerCase() ?? ""] || "";

/** Armado de una revisión en borrador: datos generales, slides (copy + arte), orden y publicación al cliente. */
export function ReviewBuilder({ data, team }: { data: ReviewData; team: { id: string; name: string }[] }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [slides, setSlides] = useState<SlideData[]>(data.slides);
  const [openId, setOpenId] = useState<string | null>(data.slides.at(-1)?.id ?? null);
  const [adding, startAdd] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  // ---- Datos generales ----
  const [meta, setMeta] = useState({ title: data.title, copyUserId: data.copyUserId ?? "", artUserId: data.artUserId ?? "", respondBy: data.respondBy ?? "", notifyEmails: data.notifyEmails });
  const [metaState, setMetaState] = useState<{ ok: boolean; text: string }>();
  const [savingMeta, startMeta] = useTransition();

  // ---- Reordenar: arrastrar con el asa o con las flechas ----
  const ref = useRef(slides);
  ref.current = slides;
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [dragId, setDragId] = useState<string | null>(null);

  async function commitOrder(before: SlideData[]) {
    const r = await reorderSlides(data.id, ref.current.map((s) => s.id));
    if (r.error) {
      setSlides(before);
      setMsg({ ok: false, text: r.error });
    }
  }
  function step(id: string, dir: -1 | 1) {
    const before = ref.current;
    const i = before.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= before.length) return;
    const next = [...before];
    [next[i], next[j]] = [next[j], next[i]];
    ref.current = next;
    setSlides(next);
    void commitOrder(before);
  }
  function startDrag(id: string, e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const before = ref.current;
    const prevOpen = openId;
    setDragId(id);
    let y = e.clientY;
    let raf = 0;
    const reposition = () => {
      const list = ref.current;
      const from = list.findIndex((s) => s.id === id);
      let to = list.length - 1;
      for (let k = 0; k < list.length; k++) {
        const el = cards.current.get(list[k].id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y < r.top + r.height / 2) { to = k; break; }
      }
      if (to !== from) {
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        ref.current = next;
        setSlides(next);
      }
    };
    const tick = () => {
      if (y < 90) window.scrollBy(0, -14);
      else if (y > window.innerHeight - 90) window.scrollBy(0, 14);
      reposition();
      raf = requestAnimationFrame(tick);
    };
    const move = (ev: PointerEvent) => { y = ev.clientY; reposition(); };
    const end = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setDragId(null);
      setOpenId(prevOpen);
      if (ref.current.some((s, k) => s.id !== before[k]?.id)) void commitOrder(before);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    raf = requestAnimationFrame(tick);
  }

  function add() {
    startAdd(async () => {
      const s = await addSlide(data.id);
      const slide: SlideData = { ...s, status: "PENDIENTE", approvedByName: null, approvedAt: null, reopenedReason: null, comments: [] };
      setSlides((prev) => [...prev, slide]);
      setOpenId(slide.id);
    });
  }

  async function publish() {
    setMsg(undefined);
    const ok = await confirm({
      title: "Publicar la revisión al cliente",
      message: `Se enviará un correo a: ${meta.notifyEmails.replaceAll(",", ", ")}. Después de publicar ya no podrás agregar, quitar ni reordenar slides.`,
      confirmLabel: "Publicar",
    });
    if (!ok) return;
    startPublish(async () => {
      const r = await publishReview(data.id);
      if (r.error && !r.ok) return setMsg({ ok: false, text: r.error });
      if (r.error) setMsg({ ok: false, text: r.error });
      router.refresh();
    });
  }

  const dirtyHint = useMemo(() => slides.length === 0, [slides.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{data.title}</h1>
          <p className="meta">{data.clientName} · {data.projectName} · <strong>Borrador</strong>: el cliente todavía no lo ve.</p>
        </div>
        <button type="button" className="btn" onClick={publish} disabled={publishing || dirtyHint}><Send size={16} /> {publishing ? "Publicando…" : "Publicar al cliente"}</button>
      </div>
      {msg && <p className={cn("text-sm", msg.ok ? "text-[#248A3D]" : "text-destructive")}>{msg.text}</p>}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Datos generales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="m-title">Título</label>
            <input id="m-title" className="input" maxLength={191} value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="m-copy">Ajustes de COPY los atiende</label>
            <select id="m-copy" className="input" value={meta.copyUserId} onChange={(e) => setMeta((m) => ({ ...m, copyUserId: e.target.value }))}>
              <option value="">Elige a una persona…</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-art">Ajustes de ARTE los atiende</label>
            <select id="m-art" className="input" value={meta.artUserId} onChange={(e) => setMeta((m) => ({ ...m, artUserId: e.target.value }))}>
              <option value="">Elige a una persona…</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-resp">El cliente debe responder antes del</label>
            <DateInput id="m-resp" value={meta.respondBy} onChange={(e) => setMeta((m) => ({ ...m, respondBy: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Correos a los que se avisa</label>
            <EmailPills name="notifyEmails" defaultValue={meta.notifyEmails} onChange={(csv) => setMeta((m) => (m.notifyEmails === csv ? m : { ...m, notifyEmails: csv }))} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button" className="btn-outline" disabled={savingMeta}
            onClick={() => startMeta(async () => {
              const r = await updateReviewMeta(data.id, meta);
              setMetaState(r.error ? { ok: false, text: r.error } : { ok: true, text: "Datos guardados" });
            })}
          >
            {savingMeta ? "Guardando…" : "Guardar datos generales"}
          </button>
          {metaState && <span className={cn("text-sm", metaState.ok ? "text-[#248A3D]" : "text-destructive")}>{metaState.text}</span>}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Slides ({slides.length})</h2>
          <button type="button" className="btn" onClick={add} disabled={adding}><Plus size={16} /> Agregar slide</button>
        </div>
        <p className="meta">Cada slide es una publicación: su copy y su arte (imagen, video o carrusel). Arrastra con el asa ⋮⋮ o usa las flechas para cambiar el orden.</p>
        {slides.map((s, i) => (
          <div key={s.id} ref={(el) => { if (el) cards.current.set(s.id, el); else cards.current.delete(s.id); }} className={dragId === s.id ? "relative z-10 rounded-2xl opacity-90 shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-2 ring-[#007AFF]" : undefined}>
            <SlideCard
              reviewId={data.id} slide={s} number={i + 1} open={dragId ? false : openId === s.id}
              onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
              onDeleted={() => setSlides((prev) => prev.filter((x) => x.id !== s.id))}
              reorder={slides.length > 1 ? { onGripDown: (e) => startDrag(s.id, e), up: () => step(s.id, -1), down: () => step(s.id, 1), isFirst: i === 0, isLast: i === slides.length - 1 } : undefined}
            />
          </div>
        ))}
        {slides.length === 0 && <p className="card meta">Todavía no hay slides. Pulsa «Agregar slide» para empezar.</p>}
      </section>
    </div>
  );
}

type Reorder = { onGripDown: (e: React.PointerEvent) => void; up: () => void; down: () => void; isFirst: boolean; isLast: boolean };

function SlideCard({ reviewId, slide, number, open, onToggle, onDeleted, reorder }: {
  reviewId: string; slide: SlideData; number: number; open: boolean; onToggle: () => void; onDeleted: () => void; reorder?: Reorder;
}) {
  const { confirm } = useDialogs();
  const [copy, setCopy] = useState(slide.copy);
  const [channel, setChannel] = useState(slide.channel);
  const [publishOn, setPublishOn] = useState(slide.publishOn ?? "");
  const [assets, setAssets] = useState<AssetData[]>(slide.assets);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string>();
  const [progress, setProgress] = useState<string>();
  const first = useRef(true);
  const kind = artKind(assets);

  // Autoguardado: espera a que se deje de escribir
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setState("saving");
    const t = setTimeout(async () => {
      const r = await saveSlide(slide.id, { copy, channel, publishOn: publishOn || null });
      setState(r.error ? "error" : "saved");
      setErr(r.error);
    }, 900);
    return () => clearTimeout(t);
  }, [copy, channel, publishOn, slide.id]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(undefined);
    for (const f of Array.from(files)) {
      setProgress(`Subiendo ${f.name}…`);
      try {
        const res = await fetch(`/api/revisiones/${reviewId}/slides/${slide.id}/assets`, { method: "POST", headers: { "content-type": mimeOf(f), "x-file-name": encodeURIComponent(f.name) }, body: f });
        const j = (await res.json().catch(() => ({}))) as { id?: string; type?: string; name?: string; error?: string };
        if (!res.ok || !j.id) { setErr(j.error ?? "No se pudo subir el archivo"); break; }
        setAssets((a) => [...a, { id: j.id!, type: j.type!, name: j.name ?? f.name }]);
      } catch {
        setErr("No se pudo subir el archivo. Revisa tu conexión.");
        break;
      }
    }
    setProgress(undefined);
  }

  async function remove(a: AssetData) {
    const r = await deleteAsset(a.id);
    if (r.error) return setErr(r.error);
    setAssets((list) => list.filter((x) => x.id !== a.id));
  }
  async function move(a: AssetData, dir: -1 | 1) {
    const r = await moveAsset(a.id, dir);
    if (r.error) return setErr(r.error);
    setAssets((list) => {
      const i = list.findIndex((x) => x.id === a.id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const summary = copy.trim() ? copy.trim().slice(0, 70) : "Sin copy todavía";

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center gap-2 px-3 py-3">
        {reorder && (
          <span className="flex shrink-0 items-center gap-0.5 text-zinc-400">
            <button type="button" aria-label="Arrastrar para reordenar el slide" title="Arrastra para cambiar el orden" onPointerDown={reorder.onGripDown} className="cursor-grab touch-none select-none rounded-lg p-1 hover:bg-black/5 active:cursor-grabbing dark:hover:bg-white/10"><GripVertical size={18} /></button>
            <span className="flex flex-col">
              <button type="button" aria-label="Subir el slide" disabled={reorder.isFirst} onClick={reorder.up} className="rounded p-0.5 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10"><ChevronUp size={13} /></button>
              <button type="button" aria-label="Bajar el slide" disabled={reorder.isLast} onClick={reorder.down} className="rounded p-0.5 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10"><ChevronDown size={13} /></button>
            </span>
          </span>
        )}
        <ReviewThumb asset={assets[0]} index={number - 1} className="h-11 w-11 shrink-0" />
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold tracking-tight">Slide {number} <span className="font-normal text-zinc-500">· {ART_KIND_LABEL[kind]}</span></span>
          <span className="block truncate text-xs text-zinc-500">{summary}</span>
        </button>
        <span className="shrink-0 text-xs text-muted-foreground">
          {state === "saving" && "Guardando…"}
          {state === "saved" && "Guardado"}
          {state === "error" && <span className="text-destructive">Error al guardar</span>}
        </span>
        <button type="button" aria-label="Eliminar el slide" className="rounded-lg p-1.5 text-[#FF3B30] hover:bg-[#FF3B30]/10" onClick={async () => {
          if (!(await confirm({ title: "Eliminar slide", message: "El slide y sus archivos se eliminan. Esta acción no se puede deshacer.", confirmLabel: "Eliminar", danger: true }))) return;
          const r = await deleteSlide(slide.id);
          if (r.error) setErr(r.error); else onDeleted();
        }}><Trash2 size={16} /></button>
        <button type="button" aria-label={open ? "Contraer" : "Abrir"} onClick={onToggle} className="rounded-lg p-1.5"><ChevronDown size={18} className={cn("text-zinc-500 transition-transform", !open && "-rotate-90")} /></button>
      </div>

      <div className={cn("space-y-4 border-t border-black/5 px-4 py-4 dark:border-white/10", !open && "hidden")}>
        <div>
          <div className="flex items-end justify-between"><label className="label" htmlFor={`copy-${slide.id}`}>Copy</label><span className={cn("text-xs", copy.length > MAX_COPY ? "text-destructive" : "text-zinc-500")}>{copy.length} / {MAX_COPY}</span></div>
          <textarea id={`copy-${slide.id}`} rows={6} maxLength={MAX_COPY} className="input" value={copy} onChange={(e) => setCopy(e.target.value)} placeholder="Escribe el texto de la publicación, con emojis y hashtags si los lleva." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`ch-${slide.id}`}>Canal</label>
            <select id={`ch-${slide.id}`} className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor={`pub-${slide.id}`}>Fecha de publicación (opcional)</label>
            <DateInput id={`pub-${slide.id}`} value={publishOn} onChange={(e) => setPublishOn(e.target.value)} />
          </div>
        </div>
        <div>
          <p className="label">Arte · {ART_KIND_LABEL[kind]}</p>
          <div className="flex flex-wrap gap-3">
            {assets.map((a, i) => (
              <div key={a.id} className="w-28 space-y-1">
                <div className="relative">
                  <ReviewThumb asset={a} index={i} className="h-28 w-28" />
                  <button type="button" aria-label={`Quitar ${a.name}`} onClick={() => remove(a)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X size={12} /></button>
                  <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] text-white">{i + 1}</span>
                </div>
                {assets.length > 1 && (
                  <div className="flex justify-between">
                    <button type="button" aria-label="Mover antes" disabled={i === 0} onClick={() => move(a, -1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10"><ArrowLeft size={14} /></button>
                    <button type="button" aria-label="Mover después" disabled={i === assets.length - 1} onClick={() => move(a, 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-25 dark:hover:bg-white/10"><ArrowRight size={14} /></button>
                  </div>
                )}
              </div>
            ))}
            {(kind === "NONE" || (kind !== "VIDEO" && assets.length < MAX_ASSETS)) && (
              <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-black/15 text-center text-xs text-zinc-500 hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/5">
                <Upload size={18} />
                {kind === "NONE" ? "Subir imagen(es) o video" : "Agregar imagen"}
                <input type="file" className="hidden" multiple accept="image/jpeg,image/png,video/mp4,video/webm,video/quicktime" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Imágenes JPG o PNG (hasta 8 MB cada una; varias forman un carrusel de hasta {MAX_ASSETS}) o un video MP4, WEBM o MOV (hasta 100 MB).</p>
          {progress && <p className="mt-1 text-sm text-zinc-500">{progress}</p>}
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}
