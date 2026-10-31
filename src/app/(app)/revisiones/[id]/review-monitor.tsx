"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Send, Upload, X } from "lucide-react";
import { applyNewArt, deleteAsset, discardNewArt, reopenSlide, resolveComment, saveSlideCopy } from "@/app/actions/reviews";
import { useDialogs } from "@/components/dialogs";
import { PostSimulator } from "@/components/post-simulator";
import { ReviewThumb } from "@/components/review-thumb";
import { artKind, ART_KIND_LABEL, channelLabel, fmtSec, MAX_ASSETS, MAX_COPY, REVIEW_STATUS_LABEL, REVIEW_STATUS_STYLE, SLIDE_STATUS_LABEL, SLIDE_STATUS_STYLE } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import { SendToClientModal } from "../send-to-client-modal";
import type { CommentData, ReviewData, SlideData } from "./types";

const when = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const mimeOf = (f: File) => f.type || MIME_BY_EXT[f.name.split(".").pop()?.toLowerCase() ?? ""] || "";

/** Seguimiento de una revisión publicada: estado de cada slide, comentarios del cliente y atención de los ajustes. */
export function ReviewMonitor({ data, team, focusSlide }: { data: ReviewData; team: { id: string; name: string }[]; focusSlide?: string }) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [error, setError] = useState<string>();
  const [sendOpen, setSendOpen] = useState(false);
  const name = (id: string | null) => team.find((t) => t.id === id)?.name ?? "—";
  const done = data.slides.filter((s) => s.status === "APROBADO").length;
  const roundComments = data.slides.flatMap((s) => s.comments.filter((c) => c.sentAt && c.round === data.round));
  const pending = roundComments.filter((c) => !c.resolvedAt).length;
  const adjusting = data.status === "EN_AJUSTES";

  // Al llegar desde el enlace de una subtarea, se baja al slide indicado
  useEffect(() => {
    if (!focusSlide) return;
    const t = setTimeout(() => document.getElementById(`slide-${focusSlide}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    return () => clearTimeout(t);
  }, [focusSlide]);

  async function reopen(slideId: string) {
    const reason = await askReason({ title: "Reabrir slide", message: "El cliente podrá volver a revisarlo y comentarlo. Indica el motivo.", confirmLabel: "Reabrir" });
    if (reason === null) return;
    const r = await reopenSlide(slideId, reason);
    if (r.error) setError(r.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{data.title}</h1>
          <p className="meta">{data.clientName} · {data.projectName}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-sm font-medium", REVIEW_STATUS_STYLE[data.status])}>{REVIEW_STATUS_LABEL[data.status]}</span>
      </div>

      <section className="card grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="meta">Ronda</p><p className="font-medium">{data.round}</p></div>
        <div><p className="meta">Avance</p><p className="font-medium">{done} de {data.slides.length} aprobados</p></div>
        <div><p className="meta">Ajustes de copy / arte</p><p className="font-medium">{name(data.copyUserId)} / {name(data.artUserId)}</p></div>
        <div><p className="meta">Se avisa a</p><p className="break-words font-medium">{data.notifyEmails.replaceAll(",", ", ")}</p></div>
        {data.status === "APROBADA" && data.approvedAt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#34C759]/10 p-3 text-[#248A3D] dark:text-[#30D158] sm:col-span-2 lg:col-span-4">
            <span>Aprobada por <strong>{data.approvedByName}</strong> el {when(data.approvedAt)}.</span>
            <a href={`/api/revisiones/${data.id}/pdf`} className="btn-outline px-3 py-1.5 text-xs">Descargar PDF resumen</a>
          </div>
        )}
      </section>

      {adjusting && (
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold tracking-tight">Ajustes de la ronda {data.round}</p>
            <p className="meta">{roundComments.length - pending} de {roundComments.length} hechos. Corrige el copy o el arte de cada slide, marca el ajuste como hecho y envía todo al cliente.</p>
          </div>
          <button type="button" className="btn" onClick={() => setSendOpen(true)}><Send size={16} /> Enviar al cliente</button>
        </section>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Slides</h2>
        {data.slides.map((s, i) => (
          <SlideReview key={s.id} reviewId={data.id} client={{ id: data.clientId, name: data.clientName, hasLogo: data.clientHasLogo }} slide={s} index={i} round={data.round} adjusting={adjusting} focus={focusSlide === s.id} onReopen={() => reopen(s.id)} onError={setError} />
        ))}
      </section>

      <SendToClientModal reviewId={data.id} open={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  );
}

function SlideReview({ reviewId, client, slide: s, index, round, adjusting, focus, onReopen, onError }: {
  reviewId: string; client: { id: string; name: string; hasLogo: boolean }; slide: SlideData; index: number; round: number; adjusting: boolean; focus: boolean; onReopen: () => void; onError: (m: string | undefined) => void;
}) {
  const router = useRouter();
  const [copy, setCopy] = useState(s.copy);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>();
  const [sim, setSim] = useState(false);
  const editable = adjusting && (s.status === "CAMBIOS" || s.status === "PENDIENTE");
  const sent = s.comments.filter((c) => c.sentAt);
  const current = sent.filter((c) => c.round === round);
  const earlier = sent.filter((c) => c.round !== round);
  const pendingKind = artKind(s.pendingAssets);

  useEffect(() => setCopy(s.copy), [s.copy]);

  async function run(fn: () => Promise<{ error?: string }>) {
    setBusy(true);
    onError(undefined);
    const r = await fn();
    setBusy(false);
    if (r.error) onError(r.error);
    else router.refresh();
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    onError(undefined);
    for (const f of Array.from(files)) {
      setProgress(`Subiendo ${f.name}…`);
      try {
        const res = await fetch(`/api/revisiones/${reviewId}/slides/${s.id}/assets`, { method: "POST", headers: { "content-type": mimeOf(f), "x-file-name": encodeURIComponent(f.name) }, body: f });
        const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !j.id) { onError(j.error ?? "No se pudo subir el archivo"); break; }
      } catch {
        onError("No se pudo subir el archivo. Revisa tu conexión.");
        break;
      }
    }
    setProgress(undefined);
    router.refresh();
  }

  return (
    <article id={`slide-${s.id}`} className={cn("card space-y-3 scroll-mt-4", focus && "ring-2 ring-[#007AFF]")}>
      <div className="flex flex-wrap items-center gap-3">
        <ReviewThumb asset={s.assets[0]} index={index} className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-tight">Slide {s.position} <span className="font-normal text-zinc-500">· {ART_KIND_LABEL[artKind(s.assets)]} · {channelLabel(s.channel)} · copy v{s.copyVersion} · arte v{s.artVersion}</span></p>
          <p className="truncate text-xs text-zinc-500">{s.copy}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", SLIDE_STATUS_STYLE[s.status])}>{SLIDE_STATUS_LABEL[s.status]}</span>
        {s.assets.length > 0 && <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setSim(true)}>Simular</button>}
        {s.status === "APROBADO" && <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={onReopen}><RotateCcw size={13} /> Reabrir</button>}
      </div>
      {s.status === "APROBADO" && <p className="text-xs text-zinc-500">Aprobado por {s.approvedByName}{s.approvedAt ? ` · ${when(s.approvedAt)}` : ""}</p>}
      {s.reopenedReason && s.status !== "APROBADO" && <p className="text-xs text-zinc-500">Reabierto: {s.reopenedReason}</p>}

      {current.length > 0 && (
        <div className="space-y-2">
          <p className="label !mb-0">Ajustes pedidos (ronda {round})</p>
          {current.map((c) => <AdjustRow key={c.id} c={c} editable={adjusting} onRun={run} />)}
        </div>
      )}

      {editable && (
        <div className="space-y-4 rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
          <div>
            <div className="flex items-end justify-between"><label className="label" htmlFor={`c-${s.id}`}>Copy (versión actual: {s.copyVersion})</label><span className={cn("text-xs", copy.length > MAX_COPY ? "text-destructive" : "text-zinc-500")}>{copy.length} / {MAX_COPY}</span></div>
            <textarea id={`c-${s.id}`} rows={5} maxLength={MAX_COPY} className="input" value={copy} onChange={(e) => setCopy(e.target.value)} />
            <button type="button" className="btn-outline mt-2 px-3 py-1.5 text-sm" disabled={busy || copy.trim() === s.copy.trim()} onClick={() => run(() => saveSlideCopy(s.id, copy))}>Guardar como versión {s.copyVersion + 1} del copy</button>
          </div>
          <div>
            <p className="label">Arte nuevo</p>
            <div className="flex flex-wrap items-start gap-3">
              {s.pendingAssets.map((a, i) => (
                <div key={a.id} className="relative">
                  <ReviewThumb asset={a} index={i} className="h-24 w-24" />
                  <button type="button" aria-label={`Quitar ${a.name}`} onClick={() => run(() => deleteAsset(a.id))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X size={12} /></button>
                </div>
              ))}
              {(pendingKind === "NONE" || (pendingKind !== "VIDEO" && s.pendingAssets.length < MAX_ASSETS)) && (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-black/15 text-center text-xs text-zinc-500 hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/5">
                  <Upload size={16} />Subir arte nuevo
                  <input type="file" className="hidden" multiple accept="image/jpeg,image/png,video/mp4,video/webm,video/quicktime" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            {progress && <p className="mt-1 text-sm text-zinc-500">{progress}</p>}
            {s.pendingAssets.length > 0 && (
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn px-3 py-1.5 text-sm" disabled={busy} onClick={() => run(() => applyNewArt(s.id))}>Usar el arte nuevo (versión {s.artVersion + 1})</button>
                <button type="button" className="btn-outline px-3 py-1.5 text-sm" disabled={busy} onClick={() => run(() => discardNewArt(s.id))}>Descartar</button>
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-500">El cliente sigue viendo el arte actual hasta que uses el nuevo. Imágenes JPG/PNG (carrusel hasta {MAX_ASSETS}) o un video.</p>
          </div>
        </div>
      )}

      <PostSimulator open={sim} onClose={() => setSim(false)} clientId={client.id} clientName={client.name} hasLogo={client.hasLogo} copy={s.copy} assets={s.assets} channel={s.channel} />

      {earlier.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500">Comentarios de rondas anteriores ({earlier.length})</summary>
          <ul className="mt-2 space-y-2">{earlier.map((c) => <li key={c.id}><AdjustRow c={c} editable={false} onRun={run} /></li>)}</ul>
        </details>
      )}
    </article>
  );
}

function AdjustRow({ c, editable, onRun }: { c: CommentData; editable: boolean; onRun: (fn: () => Promise<{ error?: string }>) => Promise<void> }) {
  const [note, setNote] = useState(c.resolvedNote ?? "");
  return (
    <div className="rounded-xl border border-black/5 p-3 text-sm dark:border-white/10">
      <p className="mb-1 text-xs text-zinc-500">
        <strong className="text-foreground">{c.authorName}</strong> · {c.target === "COPY" ? "Copy" : "Arte"}
        {c.imageNo ? ` · imagen ${c.imageNo}` : ""}{c.videoSec != null ? ` · video ${fmtSec(c.videoSec)}` : ""} · ronda {c.round} · {c.sentAt ? when(c.sentAt) : ""}
      </p>
      <p className="whitespace-pre-wrap">{c.body}</p>
      {editable ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input type="checkbox" className="h-4 w-4 accent-[#34C759]" checked={!!c.resolvedAt} onChange={(e) => onRun(() => resolveComment(c.id, e.target.checked, note))} /> Ajuste hecho
          </label>
          {!c.resolvedAt && <input className="input !py-1 flex-1 text-xs" placeholder="Nota para el cliente (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
          {c.resolvedAt && c.resolvedNote && <span className="text-xs text-zinc-500">Nota: {c.resolvedNote}</span>}
        </div>
      ) : (
        c.resolvedAt && <p className="mt-1 text-xs text-[#248A3D] dark:text-[#30D158]">✔ Resuelto{c.resolvedNote ? `: ${c.resolvedNote}` : ""}</p>
      )}
    </div>
  );
}
