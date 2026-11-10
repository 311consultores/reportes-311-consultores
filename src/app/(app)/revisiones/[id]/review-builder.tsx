"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, GripVertical, Plus, Send, Trash2, Upload, X } from "lucide-react";
import { addSlide, deleteAsset, deleteSlide, moveAsset, publishReview, reorderSlides, saveSlide, updateReviewMeta } from "@/app/actions/reviews";
import { ConsultantPicker, type TeamOption } from "@/components/consultant-picker";
import { CopyEditor } from "@/components/copy-editor";
import { DateInput } from "@/components/date-input";
import { SlideKindPill } from "@/components/slide-kind-pill";
import { PostSimulator } from "@/components/post-simulator";
import { useDialogs } from "@/components/dialogs";
import { EmailPills } from "@/components/email-pills";
import { SearchSelect } from "@/components/search-select";
import { splitEmails, uniqueEmails } from "@/lib/emails";
import { ReviewThumb } from "@/components/review-thumb";
import { ART_KIND_LABEL, artKind, CHANNELS, channelsOf, MAX_ASSETS, MAX_COPY, SLIDE_KINDS, slideName } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import type { AssetData, ReviewData, SlideData } from "./types";

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const mimeOf = (f: File) => f.type || MIME_BY_EXT[f.name.split(".").pop()?.toLowerCase() ?? ""] || "";

/** Armado de una revisión en borrador: datos generales, slides (copy + arte), orden y publicación al cliente. */
type ClientOpt = { id: string; companyName: string; mainEmails: string; projects: { id: string; projectName: string; projectEmails: string }[] };

export function ReviewBuilder({ data, team, clients }: { data: ReviewData; team: TeamOption[]; clients: ClientOpt[] }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [slides, setSlides] = useState<SlideData[]>(data.slides);
  const [openId, setOpenId] = useState<string | null>(data.slides.at(-1)?.id ?? null);
  const [adding, startAdd] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  // ---- Datos generales ----
  const [meta, setMeta] = useState({ clientId: data.clientId, projectId: data.projectId, title: data.title, copyUserId: data.copyUserId ?? "", artUserId: data.artUserId ?? "", respondBy: data.respondBy ?? "", notifyEmails: data.notifyEmails });
  const [metaState, setMetaState] = useState<{ ok: boolean; text: string }>();
  const [savingMeta, startMeta] = useTransition();
  const [metaOpen, setMetaOpen] = useState(false); // los datos generales aparecen plegados
  const nameOf = (id: string) => team.find((t) => t.id === id)?.name ?? "—";
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.companyName })), [clients]);
  const metaClient = clients.find((c) => c.id === meta.clientId);
  const [emailsKey, setEmailsKey] = useState(0);
  const suggestEmails = (c: ClientOpt | undefined, projectId: string) =>
    c ? uniqueEmails([...splitEmails(c.mainEmails), ...splitEmails(c.projects.find((p) => p.id === projectId)?.projectEmails ?? "")]).join(",") : "";

  // Cuando el botón superior «Agregar slide» sale de la pantalla, aparece uno flotante que acompaña al usuario
  const addBtn = useRef<HTMLButtonElement>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  useEffect(() => {
    const el = addBtn.current;
    if (!el) return;
    const check = () => setHeaderVisible(el.getBoundingClientRect().bottom > 0);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

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
      const slide: SlideData = { ...s, status: "PENDIENTE", approvedByName: null, approvedAt: null, reopenedReason: null, copyVersion: 1, prevCopy: null, artVersion: 1, prevAssets: [], pendingAssets: [], comments: [] };
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
        <button type="button" aria-expanded={metaOpen} onClick={() => setMetaOpen((v) => !v)} className="flex w-full items-center gap-3 text-left">
          <ChevronDown size={18} className={cn("shrink-0 text-zinc-500 transition-transform duration-200", !metaOpen && "-rotate-90")} />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold tracking-tight">Datos generales</span>
            <span className="block truncate text-sm text-zinc-500">{meta.title} · Copy: {nameOf(meta.copyUserId)} · Arte: {nameOf(meta.artUserId)}{meta.respondBy ? ` · Responder antes del ${meta.respondBy.split("-").reverse().join("/")}` : ""}</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-[#007AFF]">{metaOpen ? "Ocultar" : "Ver y editar"}</span>
        </button>
        <div className={cn("grid gap-4 sm:grid-cols-2", !metaOpen && "hidden")}>
          <div>
            <label className="label">Cliente</label>
            <SearchSelect
              name="clientId" required options={clientOptions} value={meta.clientId} placeholder="Escribe para buscar un cliente…"
              onChange={(v) => {
                if (!v || v === meta.clientId) return;
                const c = clients.find((x) => x.id === v);
                // Al cambiar de cliente se elige su primer proyecto y se sugieren sus correos (se pueden ajustar)
                const projectId = c?.projects[0]?.id ?? "";
                setMeta((m) => ({ ...m, clientId: v, projectId, notifyEmails: suggestEmails(c, projectId) }));
                setEmailsKey((k) => k + 1);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="m-project">Proyecto</label>
            <select
              id="m-project" className="input" value={meta.projectId}
              onChange={(e) => { const projectId = e.target.value; setMeta((m) => ({ ...m, projectId, notifyEmails: suggestEmails(metaClient, projectId) })); setEmailsKey((k) => k + 1); }}
            >
              {(metaClient?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="m-title">Título</label>
            <input id="m-title" className="input" maxLength={191} value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Ajustes de COPY los atiende</label>
            <ConsultantPicker single options={team} name="copyUserId" initial={meta.copyUserId ? [meta.copyUserId] : []} hint="" searchText="Escribe para buscar a una persona…" onChange={(ids) => setMeta((m) => ({ ...m, copyUserId: ids[0] ?? "" }))} />
          </div>
          <div>
            <label className="label">Ajustes de ARTE los atiende</label>
            <ConsultantPicker single options={team} name="artUserId" initial={meta.artUserId ? [meta.artUserId] : []} hint="" searchText="Escribe para buscar a una persona…" onChange={(ids) => setMeta((m) => ({ ...m, artUserId: ids[0] ?? "" }))} />
          </div>
          <div>
            <label className="label" htmlFor="m-resp">El cliente debe responder antes del</label>
            <DateInput id="m-resp" value={meta.respondBy} onChange={(e) => setMeta((m) => ({ ...m, respondBy: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Correos a los que se avisa</label>
            <EmailPills key={emailsKey} name="notifyEmails" defaultValue={meta.notifyEmails} onChange={(csv) => setMeta((m) => (m.notifyEmails === csv ? m : { ...m, notifyEmails: csv }))} />
          </div>
        </div>
        <div className={cn("flex items-center gap-3", !metaOpen && "hidden")}>
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
          <button ref={addBtn} type="button" className="btn" onClick={add} disabled={adding}><Plus size={16} /> Agregar slide</button>
        </div>
        <p className="meta">Cada slide es una publicación: su copy y su arte (imagen, video o carrusel). Arrastra con el asa ⋮⋮ o usa las flechas para cambiar el orden.</p>
        {slides.map((s, i) => (
          <div key={s.id} ref={(el) => { if (el) cards.current.set(s.id, el); else cards.current.delete(s.id); }} className={dragId === s.id ? "relative z-10 rounded-2xl opacity-90 shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-2 ring-[#007AFF]" : undefined}>
            <SlideCard
              reviewId={data.id} client={{ id: data.clientId, name: data.clientName, hasLogo: data.clientHasLogo }} slide={s} number={i + 1} open={dragId ? false : openId === s.id}
              onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
              onDeleted={() => setSlides((prev) => prev.filter((x) => x.id !== s.id))}
              reorder={slides.length > 1 ? { onGripDown: (e) => startDrag(s.id, e), up: () => step(s.id, -1), down: () => step(s.id, 1), isFirst: i === 0, isLast: i === slides.length - 1 } : undefined}
            />
          </div>
        ))}
        {slides.length === 0 && <p className="card meta">Todavía no hay slides. Pulsa «Agregar slide» para empezar.</p>}
      </section>

      {!headerVisible && (
        <button type="button" className="btn fixed bottom-6 right-6 z-40 rounded-full px-5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.25)]" onClick={add} disabled={adding}>
          <Plus size={18} /> Agregar slide
        </button>
      )}
    </div>
  );
}

type Reorder = { onGripDown: (e: React.PointerEvent) => void; up: () => void; down: () => void; isFirst: boolean; isLast: boolean };

function SlideCard({ reviewId, client, slide, number, open, onToggle, onDeleted, reorder }: {
  reviewId: string; client: { id: string; name: string; hasLogo: boolean }; slide: SlideData; number: number; open: boolean; onToggle: () => void; onDeleted: () => void; reorder?: Reorder;
}) {
  const { confirm } = useDialogs();
  const [copy, setCopy] = useState(slide.copy);
  const [title, setTitle] = useState(slide.title ?? "");
  const [kindSel, setKindSel] = useState(slide.kind ?? "");
  const [channels, setChannels] = useState<string[]>(channelsOf(slide.channel).length ? channelsOf(slide.channel) : ["FACEBOOK"]);
  const [publishOn, setPublishOn] = useState(slide.publishOn ?? "");
  const [assets, setAssets] = useState<AssetData[]>(slide.assets);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string>();
  const [progress, setProgress] = useState<string>();
  const [sim, setSim] = useState(false);
  const first = useRef(true);
  const kind = artKind(assets);
  const toggleChannel = (c: string, on: boolean) => setChannels((list) => (on ? [...new Set([...list, c])] : list.filter((x) => x !== c)));

  // Autoguardado: espera a que se deje de escribir
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setState("saving");
    const t = setTimeout(async () => {
      const r = await saveSlide(slide.id, { title, kind: kindSel, copy, channels, publishOn: publishOn || null });
      setState(r.error ? "error" : "saved");
      setErr(r.error);
    }, 900);
    return () => clearTimeout(t);
  }, [copy, title, kindSel, channels, publishOn, slide.id]);

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
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight">{slideName(number, title)} <SlideKindPill kind={kindSel} />{!kindSel && <span className="rounded-full bg-[#FF3B30]/10 px-2 py-0.5 text-[11px] font-medium text-[#D70015]">Falta el tipo</span>}</span>
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
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div>
            <label className="label" htmlFor={`title-${slide.id}`}>Título del slide (opcional)</label>
            <input id={`title-${slide.id}`} className="input" maxLength={191} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lanzamiento de la nueva línea" />
          </div>
          <div>
            <label className="label" htmlFor={`kind-${slide.id}`}>Tipo (obligatorio)</label>
            <select id={`kind-${slide.id}`} className="input" value={kindSel} onChange={(e) => setKindSel(e.target.value)}>
              <option value="">Elige el tipo…</option>
              {SLIDE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.value}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`copy-${slide.id}`}>Copy</label>
          <CopyEditor id={`copy-${slide.id}`} value={copy} onChange={setCopy} max={MAX_COPY} placeholder="Escribe el texto de la publicación, con emojis y hashtags si los lleva." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label">Canales</p>
            <div className="flex flex-wrap gap-4">
              {CHANNELS.map((c) => (
                <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[#007AFF]" checked={channels.includes(c.value)} onChange={(e) => toggleChannel(c.value, e.target.checked)} /> {c.label}
                </label>
              ))}
            </div>
            {channels.length === 0 && <p className="mt-1 text-xs text-destructive">Marca al menos un canal.</p>}
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
        {assets.length > 0 && <button type="button" className="btn-outline px-3.5 py-2 text-sm" onClick={() => setSim(true)}>Simular vista en redes</button>}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <PostSimulator open={sim} onClose={() => setSim(false)} clientId={client.id} clientName={client.name} hasLogo={client.hasLogo} copy={copy} assets={assets} channel={channels.join(",")} />
      </div>
    </div>
  );
}
