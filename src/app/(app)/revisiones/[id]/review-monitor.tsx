"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { reopenSlide } from "@/app/actions/reviews";
import { useDialogs } from "@/components/dialogs";
import { ReviewThumb } from "@/components/review-thumb";
import { artKind, ART_KIND_LABEL, channelLabel, fmtSec, REVIEW_STATUS_LABEL, REVIEW_STATUS_STYLE, SLIDE_STATUS_LABEL, SLIDE_STATUS_STYLE } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import type { ReviewData } from "./types";

const when = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Seguimiento de una revisión ya publicada: estado de cada slide y los comentarios del cliente. */
export function ReviewMonitor({ data, team }: { data: ReviewData; team: { id: string; name: string }[] }) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [error, setError] = useState<string>();
  const name = (id: string | null) => team.find((t) => t.id === id)?.name ?? "—";
  const done = data.slides.filter((s) => s.status === "APROBADO").length;

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
        {data.status === "APROBADA" && data.approvedAt && <div className="sm:col-span-2 lg:col-span-4 rounded-xl bg-[#34C759]/10 p-3 text-[#248A3D] dark:text-[#30D158]">Aprobada por <strong>{data.approvedByName}</strong> el {when(data.approvedAt)}.</div>}
      </section>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Slides</h2>
        {data.slides.map((s, i) => {
          const sent = s.comments.filter((c) => c.sentAt);
          return (
            <article key={s.id} className="card space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <ReviewThumb asset={s.assets[0]} index={i} className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-tight">Slide {s.position} <span className="font-normal text-zinc-500">· {ART_KIND_LABEL[artKind(s.assets)]} · {channelLabel(s.channel)}</span></p>
                  <p className="truncate text-xs text-zinc-500">{s.copy}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", SLIDE_STATUS_STYLE[s.status])}>{SLIDE_STATUS_LABEL[s.status]}</span>
                {s.status === "APROBADO" && <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => reopen(s.id)}><RotateCcw size={13} /> Reabrir</button>}
              </div>
              {s.status === "APROBADO" && <p className="text-xs text-zinc-500">Aprobado por {s.approvedByName}{s.approvedAt ? ` · ${when(s.approvedAt)}` : ""}</p>}
              {s.reopenedReason && s.status !== "APROBADO" && <p className="text-xs text-zinc-500">Reabierto: {s.reopenedReason}</p>}
              {sent.length > 0 && (
                <ul className="space-y-2">
                  {sent.map((c) => (
                    <li key={c.id} className="rounded-xl border border-black/5 p-3 text-sm dark:border-white/10">
                      <p className="mb-1 text-xs text-zinc-500">
                        <strong className="text-foreground">{c.authorName}</strong> · {c.target === "COPY" ? "Copy" : "Arte"}
                        {c.imageNo ? ` · imagen ${c.imageNo}` : ""}{c.videoSec != null ? ` · video ${fmtSec(c.videoSec)}` : ""} · ronda {c.round} · {c.sentAt ? when(c.sentAt) : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
