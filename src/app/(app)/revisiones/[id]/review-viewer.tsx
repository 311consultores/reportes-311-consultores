"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { approveSlide, deleteComment, saveComment, sendAdjustments, startReview } from "@/app/actions/reviews";
import { Modal } from "@/components/modal";
import { ReviewThumb } from "@/components/review-thumb";
import { artKind, assetUrl, channelLabel, fmtSec, MAX_COMMENT, parseSec, REVIEW_STATUS_LABEL, SLIDE_STATUS_LABEL, SLIDE_STATUS_STYLE } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import type { CommentData, ReviewData, SlideData } from "./types";

type Tab = "COPY" | "ART" | "HIST";
type Draft = { key: string; id?: string; target: "COPY" | "ART"; body: string; imageNo: number | null; videoSec: string; savedAt?: string };

const when = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const uid = () => Math.random().toString(36).slice(2);

/** Visor del cliente: miniaturas, slide con copy y arte, comentarios con guardado automático, aprobación y envío de ajustes. */
export function ReviewViewer({ data, meId }: { data: ReviewData; meId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(data.status);
  const [slides, setSlides] = useState<SlideData[]>(data.slides);
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("COPY");
  const [imgIdx, setImgIdx] = useState(0);
  const [intro, setIntro] = useState(data.status === "PUBLICADA" && !data.startedAt);
  const [approving, setApproving] = useState<string | null>(null);
  const [sentModal, setSentModal] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  // Borradores del cliente (los comentarios que todavía no se envían), por slide
  const [drafts, setDrafts] = useState<Record<string, Draft[]>>(() => {
    const out: Record<string, Draft[]> = {};
    for (const s of data.slides) {
      out[s.id] = s.comments.filter((c) => !c.sentAt && c.authorId === meId).map((c) => ({ key: c.id, id: c.id, target: c.target, body: c.body, imageNo: c.imageNo, videoSec: c.videoSec != null ? fmtSec(c.videoSec) : "" }));
    }
    return out;
  });

  const slide = slides[idx];
  const sentOf = (s: SlideData): CommentData[] => s.comments.filter((c) => c.sentAt);
  const draftsOf = (sid: string) => (drafts[sid] ?? []).filter((d) => d.body.trim());
  const totalDrafts = useMemo(() => Object.values(drafts).reduce((n, l) => n + l.filter((d) => d.body.trim()).length, 0), [drafts]);
  const open = status === "PUBLICADA" && !intro;
  const canComment = open && (slide.status === "PENDIENTE" || slide.status === "AJUSTADO");
  const kind = artKind(slide.assets);

  const go = useCallback((n: number) => { setIdx(Math.max(0, Math.min(slides.length - 1, n))); setImgIdx(0); }, [slides.length]);

  // Flechas del teclado para pasar de slide (sin interferir al escribir)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, go]);

  const patchDraft = useCallback((sid: string, key: string, patch: Partial<Draft>) => {
    setDrafts((d) => ({ ...d, [sid]: (d[sid] ?? []).map((x) => (x.key === key ? { ...x, ...patch } : x)) }));
  }, []);

  function addDraft(target: "COPY" | "ART") {
    setTab(target);
    setDrafts((d) => ({ ...d, [slide.id]: [...(d[slide.id] ?? []), { key: uid(), target, body: "", imageNo: kind === "CAROUSEL" ? imgIdx + 1 : null, videoSec: "" }] }));
  }

  async function removeDraft(sid: string, dr: Draft) {
    if (dr.id) {
      const r = await deleteComment(dr.id);
      if (r.error) return setNotice({ ok: false, text: r.error });
    }
    setDrafts((d) => ({ ...d, [sid]: (d[sid] ?? []).filter((x) => x.key !== dr.key) }));
  }

  async function begin() {
    setBusy(true);
    await startReview(data.id);
    setBusy(false);
    setIntro(false);
  }

  async function approve(sid: string) {
    setBusy(true);
    const r = await approveSlide(sid);
    setBusy(false);
    setApproving(null);
    if (r.error) return setNotice({ ok: false, text: r.error });
    setSlides((all) => all.map((s) => (s.id === sid ? { ...s, status: "APROBADO", approvedByName: "ti", approvedAt: new Date().toISOString() } : s)));
    setNotice({ ok: true, text: r.allApproved ? "¡Listo! Aprobaste todos los slides. Gracias por tu revisión." : "Slide aprobado." });
    if (r.allApproved) { setStatus("APROBADA"); router.refresh(); }
    else if (idx < slides.length - 1) go(idx + 1);
  }

  async function send() {
    setNotice(undefined);
    setBusy(true);
    const r = await sendAdjustments(data.id);
    setBusy(false);
    if (r.error) return setNotice({ ok: false, text: r.error });
    const now = new Date().toISOString();
    setSlides((all) => all.map((s) => {
      const mine = draftsOf(s.id);
      if (mine.length === 0) return s;
      const sent: CommentData[] = mine.map((d) => ({ id: d.id ?? d.key, target: d.target, round: data.round, authorId: meId, authorName: "Tú", body: d.body, imageNo: d.imageNo, videoSec: parseSec(d.videoSec), sentAt: now, createdAt: now }));
      return { ...s, status: "CAMBIOS", comments: [...s.comments.filter((c) => c.sentAt), ...sent] };
    }));
    setDrafts({});
    setStatus("EN_AJUSTES");
    setSentModal(true);
  }

  const banner =
    status === "EN_AJUSTES" ? "Estamos trabajando en tus ajustes. Te avisaremos por correo cuando estén listos para que los revises."
    : status === "APROBADA" ? `Revisión aprobada${data.approvedByName ? ` por ${data.approvedByName}` : ""}. ¡Gracias!`
    : null;

  const slideDrafts = draftsOf(slide.id).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/revisiones" className="btn-outline px-3 py-1.5 text-sm"><ArrowLeft size={15} /> Revisiones</Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{data.title}</h1>
          <p className="meta">{data.projectName} · Ronda {data.round} · {slides.length} slide(s) · {REVIEW_STATUS_LABEL[status] === "Esperando al cliente" ? "Por revisar" : REVIEW_STATUS_LABEL[status]}</p>
        </div>
        {status === "PUBLICADA" && <button type="button" className="btn" disabled={busy || totalDrafts === 0} onClick={send}><Send size={16} /> Enviar ajustes{totalDrafts ? ` (${totalDrafts})` : ""}</button>}
      </div>

      {banner && <p className="card text-sm">{banner}</p>}
      {notice && <p className={cn("card text-sm", notice.ok ? "text-[#248A3D] dark:text-[#30D158]" : "text-destructive")}>{notice.text}</p>}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Miniaturas */}
        <div className="order-2 flex shrink-0 gap-2.5 overflow-x-auto pb-1 lg:order-1 lg:max-h-[72vh] lg:w-28 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:pr-1">
          {slides.map((s, i) => {
            const n = sentOf(s).length + draftsOf(s.id).length;
            return (
              <button key={s.id} type="button" onClick={() => go(i)} aria-label={`Ir al slide ${s.position}`} className={cn("relative h-20 w-24 shrink-0 rounded-xl border-2 p-0.5 lg:h-auto lg:w-full", i === idx ? "border-[#007AFF]" : "border-transparent")}>
                <ReviewThumb asset={s.assets[0]} index={i} className="h-full w-full lg:aspect-square lg:h-auto" />
                <span className="absolute left-0.5 top-0.5 rounded-br-lg rounded-tl-lg bg-black/70 px-1.5 text-[10px] text-white">{s.position}</span>
                {n > 0 && <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center gap-0.5 rounded-full border-2 border-background bg-[#FF9500] px-1 text-[10px] font-bold text-white" title={`${n} comentario(s)`}><MessageSquare size={10} />{n}</span>}
                {s.status === "APROBADO" && <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#34C759] text-white"><Check size={12} strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>

        {/* Slide */}
        <div className="order-1 min-w-0 flex-1 space-y-3 lg:order-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight">Slide {slide.position} de {slides.length}</h2>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", SLIDE_STATUS_STYLE[slide.status])}>{SLIDE_STATUS_LABEL[slide.status]}</span>
            <span className="meta">{channelLabel(slide.channel)}{slide.publishOn ? ` · Publicación ${new Date(`${slide.publishOn}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}` : ""}</span>
            {canComment && (
              <button type="button" className="btn ml-auto bg-[#34C759] px-3.5 py-2 text-sm" disabled={busy} onClick={() => (slideDrafts > 0 ? setNotice({ ok: false, text: "Este slide tiene comentarios sin enviar. Elimínalos para poder aprobarlo, o envía tus ajustes." }) : setApproving(slide.id))}>
                <Check size={15} /> Aprobar slide
              </button>
            )}
          </div>
          {slide.status === "APROBADO" && <p className="meta">Aprobado por {slide.approvedByName}{slide.approvedAt ? ` · ${when(slide.approvedAt)}` : ""}. Si necesitas un cambio, solicítalo en el grupo de trabajo por WhatsApp.</p>}

          <div className="grid gap-3 md:grid-cols-2">
            <section className="card flex flex-col gap-3">
              <p className="label !mb-0">Copy</p>
              <p className="flex-1 whitespace-pre-wrap text-[15px] leading-relaxed">{slide.copy}</p>
              {canComment && <button type="button" className="btn-outline self-start px-3 py-1.5 text-sm" onClick={() => addDraft("COPY")}><MessageSquare size={14} /> Comentar copy</button>}
            </section>

            <section className="card flex flex-col gap-3">
              <p className="label !mb-0">Arte · {kind === "CAROUSEL" ? `Carrusel (${slide.assets.length} imágenes)` : kind === "VIDEO" ? "Video" : "Imagen"}</p>
              <div className="relative flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/5 dark:bg-white/10">
                {kind === "VIDEO" ? (
                  <video ref={video} key={slide.assets[0].id} src={assetUrl(slide.assets[0].id)} controls playsInline className="max-h-[420px] w-full rounded-xl" />
                ) : slide.assets[imgIdx] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- archivo protegido de la propia app
                  <img src={assetUrl(slide.assets[imgIdx].id)} alt={`Arte del slide ${slide.position}`} className="max-h-[420px] w-full object-contain" />
                ) : <span className="text-sm text-zinc-500">Sin arte</span>}
                {kind === "CAROUSEL" && (
                  <>
                    <button type="button" aria-label="Imagen anterior" disabled={imgIdx === 0} onClick={() => setImgIdx((i) => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white disabled:opacity-30"><ChevronLeft size={18} /></button>
                    <button type="button" aria-label="Imagen siguiente" disabled={imgIdx === slide.assets.length - 1} onClick={() => setImgIdx((i) => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white disabled:opacity-30"><ChevronRight size={18} /></button>
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white">Imagen {imgIdx + 1} de {slide.assets.length}</span>
                  </>
                )}
              </div>
              {canComment && <button type="button" className="btn-outline self-start px-3 py-1.5 text-sm" onClick={() => addDraft("ART")}><MessageSquare size={14} /> Comentar arte</button>}
            </section>
          </div>
        </div>

        {/* Comentarios */}
        <aside className="card order-3 w-full shrink-0 space-y-3 lg:w-80">
          <div className="flex gap-1.5">
            {([["COPY", "Copy"], ["ART", "Arte"], ["HIST", "Historial"]] as const).map(([k, label]) => {
              const n = k === "HIST" ? 0 : sentOf(slide).filter((c) => c.target === k).length + draftsOf(slide.id).filter((d) => d.target === k).length;
              return <button key={k} type="button" onClick={() => setTab(k)} className={cn("rounded-full border px-3 py-1 text-sm", tab === k ? "border-transparent bg-foreground text-background" : "border-black/10 dark:border-white/15")}>{label}{n ? ` · ${n}` : ""}</button>;
            })}
          </div>
          {tab === "HIST" ? <History slide={slide} drafts={draftsOf(slide.id)} /> : (
            <TargetComments
              target={tab} slide={slide} drafts={(drafts[slide.id] ?? []).filter((d) => d.target === tab)} canComment={canComment} kind={kind} imageCount={slide.assets.length}
              onAdd={() => addDraft(tab)} onPatch={(key, p) => patchDraft(slide.id, key, p)} onRemove={(dr) => removeDraft(slide.id, dr)}
              currentVideoSec={() => Math.floor(video.current?.currentTime ?? 0)}
            />
          )}
        </aside>
      </div>

      {/* Bienvenida al iniciar la revisión */}
      <Modal open={intro} onClose={() => router.push("/revisiones")} title="¡Gracias por dedicarle tiempo a esta revisión!" subtitle={data.title}>
        <p className="text-sm leading-relaxed">Te sugerimos terminarla en una sola sesión, sin dejarla a medias, para no retrasar la publicación de tu contenido. Tus comentarios se guardan solos.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => router.push("/revisiones")}>Ahora no</button>
          <button type="button" className="btn" disabled={busy} onClick={begin}>Comenzar revisión</button>
        </div>
      </Modal>

      {/* Aprobar un slide */}
      <Modal open={!!approving} onClose={() => setApproving(null)} title="Aprobar este slide" subtitle={`Slide ${slide.position} de ${slides.length}`}>
        <p className="text-sm leading-relaxed">Una vez aprobado, <strong>ya no podrás enviar más ajustes</strong> sobre este slide. Si más adelante necesitas un cambio, solicítalo en el grupo de trabajo por WhatsApp.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setApproving(null)}>Cancelar</button>
          <button type="button" className="btn bg-[#34C759]" disabled={busy} onClick={() => approving && approve(approving)}>Sí, aprobar</button>
        </div>
      </Modal>

      {/* Ajustes enviados */}
      <Modal open={sentModal} onClose={() => { setSentModal(false); router.refresh(); }} title="¡Recibimos tus ajustes!" subtitle={data.title}>
        <p className="text-sm leading-relaxed">El tiempo promedio de corrección y ajuste es de <strong>24 a 48 horas</strong>, y buscaremos optimizar el tiempo de entrega. Te avisaremos por correo cuando estén listos para que los revises.</p>
        <div className="flex justify-end"><button type="button" className="btn" onClick={() => { setSentModal(false); router.refresh(); }}>Entendido</button></div>
      </Modal>
    </div>
  );
}

function TargetComments({ target, slide, drafts, canComment, kind, imageCount, onAdd, onPatch, onRemove, currentVideoSec }: {
  target: "COPY" | "ART"; slide: SlideData; drafts: Draft[]; canComment: boolean; kind: string; imageCount: number;
  onAdd: () => void; onPatch: (key: string, p: Partial<Draft>) => void; onRemove: (d: Draft) => void; currentVideoSec: () => number;
}) {
  const sent = slide.comments.filter((c) => c.sentAt && c.target === target);
  return (
    <div className="space-y-3">
      {sent.length > 0 && (
        <div className="space-y-2">
          <p className="label !mb-0">Comentarios enviados</p>
          {sent.map((c) => <SentComment key={c.id} c={c} />)}
        </div>
      )}
      {drafts.map((d) => (
        <DraftCard key={d.key} slideId={slide.id} draft={d} kind={kind} imageCount={imageCount} onPatch={(p) => onPatch(d.key, p)} onRemove={() => onRemove(d)} currentVideoSec={currentVideoSec} />
      ))}
      {canComment ? (
        <button type="button" className="btn-outline w-full justify-center px-3 py-2 text-sm" onClick={onAdd}><Plus size={14} /> {drafts.length ? "Agregar otro comentario" : `Comentar ${target === "COPY" ? "el copy" : "el arte"}`}</button>
      ) : sent.length === 0 ? <p className="text-sm text-zinc-500">Sin comentarios.</p> : null}
    </div>
  );
}

function SentComment({ c }: { c: CommentData }) {
  return (
    <div className="rounded-xl border border-black/5 p-2.5 text-sm dark:border-white/10">
      <p className="mb-1 text-xs text-zinc-500"><strong className="text-foreground">{c.authorName}</strong> · Ronda {c.round}{c.imageNo ? ` · imagen ${c.imageNo}` : ""}{c.videoSec != null ? ` · video ${fmtSec(c.videoSec)}` : ""} · {c.sentAt ? when(c.sentAt) : ""}</p>
      <p className="whitespace-pre-wrap">{c.body}</p>
    </div>
  );
}

/** Un comentario en borrador: se guarda solo mientras se escribe. */
function DraftCard({ slideId, draft, kind, imageCount, onPatch, onRemove, currentVideoSec }: {
  slideId: string; draft: Draft; kind: string; imageCount: number; onPatch: (p: Partial<Draft>) => void; onRemove: () => void; currentVideoSec: () => number;
}) {
  const patchRef = useRef(onPatch);
  patchRef.current = onPatch; // el padre crea una función nueva en cada pintada: se usa por referencia para no reiniciar el guardado
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(draft.id ? "saved" : "idle");
  const [err, setErr] = useState<string>();
  const latest = useRef(draft);
  latest.current = draft;
  const busy = useRef(false);
  const again = useRef(false);
  const first = useRef(true);

  const persist = useCallback(async () => {
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    do {
      again.current = false;
      const d = latest.current;
      if (!d.body.trim()) break;
      const sec = d.videoSec.trim() ? parseSec(d.videoSec) : null;
      const r = await saveComment({ id: d.id, slideId, target: d.target, body: d.body, imageNo: d.imageNo, videoSec: sec });
      if (r.error) { setState("error"); setErr(r.error); } else { setState("saved"); setErr(undefined); if (r.id && !latest.current.id) patchRef.current({ id: r.id }); }
    } while (again.current);
    busy.current = false;
  }, [slideId]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!draft.body.trim()) return;
    setState("saving");
    const t = setTimeout(persist, 900);
    return () => clearTimeout(t);
  }, [draft.body, draft.imageNo, draft.videoSec, persist]);

  return (
    <div className="space-y-2 rounded-xl border border-[#007AFF]/40 p-2.5">
      <div className="flex items-center justify-between">
        <p className="label !mb-0">Tu comentario</p>
        <button type="button" aria-label="Eliminar el comentario" onClick={onRemove} className="rounded-lg p-1 text-[#FF3B30] hover:bg-[#FF3B30]/10"><Trash2 size={14} /></button>
      </div>
      {draft.target === "ART" && kind === "CAROUSEL" && (
        <select className="input !py-1.5 text-sm" aria-label="Imagen a la que se refiere" value={draft.imageNo ?? ""} onChange={(e) => onPatch({ imageNo: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Sobre todo el carrusel</option>
          {Array.from({ length: imageCount }, (_, i) => <option key={i} value={i + 1}>Sobre la imagen {i + 1}</option>)}
        </select>
      )}
      {draft.target === "ART" && kind === "VIDEO" && (
        <div className="flex items-center gap-2">
          <input className="input !py-1.5 text-sm" aria-label="Minuto y segundo del video" inputMode="numeric" placeholder="Momento (0:12)" value={draft.videoSec} onChange={(e) => onPatch({ videoSec: e.target.value })} />
          <button type="button" className="btn-outline shrink-0 px-2.5 py-1.5 text-xs" onClick={() => onPatch({ videoSec: fmtSec(currentVideoSec()) })}>Usar el actual</button>
        </div>
      )}
      <textarea className="input min-h-[96px] text-sm" maxLength={MAX_COMMENT} autoFocus={!draft.id && !draft.body} value={draft.body} onChange={(e) => onPatch({ body: e.target.value })} placeholder={draft.target === "COPY" ? "¿Qué cambiarías del texto?" : "¿Qué cambiarías del arte?"} />
      <p className="text-xs text-zinc-500">
        {state === "saving" && "Guardando…"}{state === "saved" && "✔ Guardado automáticamente"}{state === "idle" && "Se guarda solo al escribir"}
        {state === "error" && <span className="text-destructive">{err ?? "No se pudo guardar"}</span>}
      </p>
    </div>
  );
}

function History({ slide, drafts }: { slide: SlideData; drafts: Draft[] }) {
  const sent = [...slide.comments.filter((c) => c.sentAt)].sort((a, b) => (a.sentAt! < b.sentAt! ? -1 : 1));
  const rounds = [...new Set(sent.map((c) => c.round))];
  return (
    <div className="space-y-3">
      {rounds.map((r) => (
        <div key={r} className="space-y-2">
          <p className="label !mb-0">Ronda {r}</p>
          {sent.filter((c) => c.round === r).map((c) => (
            <div key={c.id} className="space-y-0.5"><p className="text-[11px] text-zinc-500">{c.target === "COPY" ? "Copy" : "Arte"}</p><SentComment c={c} /></div>
          ))}
        </div>
      ))}
      {drafts.length > 0 && <p className="text-xs text-zinc-500">Tienes {drafts.length} comentario(s) sin enviar en este slide.</p>}
      {slide.status === "APROBADO" && <p className="rounded-xl bg-[#34C759]/10 p-2.5 text-sm text-[#248A3D] dark:text-[#30D158]">Aprobado por {slide.approvedByName}{slide.approvedAt ? ` · ${when(slide.approvedAt)}` : ""}</p>}
      {slide.reopenedReason && <p className="rounded-xl bg-[#FF9500]/10 p-2.5 text-sm">Reabierto por el equipo: {slide.reopenedReason}</p>}
      {rounds.length === 0 && drafts.length === 0 && slide.status !== "APROBADO" && <p className="text-sm text-zinc-500">Todavía no hay comentarios en este slide.</p>}
    </div>
  );
}
