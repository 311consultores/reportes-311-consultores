"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Share2, ThumbsUp } from "lucide-react";
import { Modal } from "@/components/modal";
import { assetUrl } from "@/lib/reviews";
import { cn } from "@/lib/utils";

type Network = "FACEBOOK" | "INSTAGRAM";
type Format = "SQUARE" | "PORTRAIT" | "STORY";
export type SimAsset = { id: string; type: string };

const FORMATS: { value: Format; label: string; ratio: string }[] = [
  { value: "SQUARE", label: "Cuadrado 1:1", ratio: "aspect-square" },
  { value: "PORTRAIT", label: "Vertical 4:5", ratio: "aspect-[4/5]" },
  { value: "STORY", label: "Historia 9:16", ratio: "aspect-[9/16]" },
];

/** Nombre de usuario estilo Instagram: sin acentos ni espacios. */
const handle = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28) || "tumarca";

/**
 * Simulación de cómo se verá una publicación en Facebook o Instagram (feed cuadrado, vertical o historia).
 * Es referencial: el aspecto final puede variar ligeramente según el dispositivo.
 */
export function PostSimulator({ open, onClose, clientId, clientName, hasLogo, copy, assets, channel }: {
  open: boolean; onClose: () => void; clientId: string; clientName: string; hasLogo: boolean; copy: string; assets: SimAsset[]; channel: string;
}) {
  const [network, setNetwork] = useState<Network>(channel === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK");
  const [format, setFormat] = useState<Format>("SQUARE");
  const [idx, setIdx] = useState(0);
  const [more, setMore] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNetwork(channel === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK");
    setIdx(0); setMore(false);
  }, [open, channel]);

  const ratio = FORMATS.find((f) => f.value === format)!.ratio;
  const isVideo = assets[0]?.type === "VIDEO";
  const user = handle(clientName);
  const initials = clientName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const avatar = (size: number) =>
    hasLogo && !logoFailed ? (
      // eslint-disable-next-line @next/next/no-img-element -- logo protegido de la propia app
      <img src={`/api/clients/${clientId}/logo`} alt="" onError={() => setLogoFailed(true)} style={{ width: size, height: size }} className="shrink-0 rounded-full border border-black/10 bg-white object-contain" />
    ) : (
      <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-[#007AFF] text-xs font-bold text-white">{initials}</span>
    );

  const media = () => (
    <div className={cn("relative w-full overflow-hidden bg-black/5", ratio)}>
      {assets.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin arte</div>
        : isVideo ? <video key={assets[0].id} src={assetUrl(assets[0].id)} controls playsInline className="h-full w-full object-cover" />
        // eslint-disable-next-line @next/next/no-img-element -- archivo protegido de la propia app
        : <img src={assetUrl(assets[idx]?.id ?? assets[0].id)} alt="" className="h-full w-full object-cover" />}
      {assets.length > 1 && !isVideo && (
        <>
          <button type="button" aria-label="Imagen anterior" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1 text-white disabled:opacity-30"><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Imagen siguiente" disabled={idx === assets.length - 1} onClick={() => setIdx((i) => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1 text-white disabled:opacity-30"><ChevronRight size={16} /></button>
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">{idx + 1}/{assets.length}</span>
        </>
      )}
    </div>
  );

  const dots = () => assets.length > 1 && !isVideo ? (
    <div className="flex justify-center gap-1 py-1.5">{assets.map((a, i) => <i key={a.id} className={cn("h-1.5 w-1.5 rounded-full", i === idx ? "bg-[#1877f2]" : "bg-zinc-300")} />)}</div>
  ) : null;

  const short = copy.length > 125 && !more;

  return (
    <Modal open={open} onClose={onClose} wide title="Así se vería publicado" subtitle={clientName}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["FACEBOOK", "INSTAGRAM"] as const).map((n) => (
            <button key={n} type="button" onClick={() => setNetwork(n)} className={cn("rounded-full border px-3.5 py-1.5 text-sm", network === n ? "border-transparent bg-foreground text-background" : "border-black/10 dark:border-white/15")}>{n === "FACEBOOK" ? "Facebook" : "Instagram"}</button>
          ))}
          <span className="w-3" />
          {FORMATS.map((f) => (
            <button key={f.value} type="button" onClick={() => setFormat(f.value)} className={cn("rounded-full border px-3.5 py-1.5 text-sm", format === f.value ? "border-transparent bg-foreground text-background" : "border-black/10 dark:border-white/15")}>{f.label}</button>
          ))}
        </div>

        <div className="flex justify-center rounded-2xl bg-[#f0f2f5] p-4 text-[#050505] dark:bg-[#18191a]">
          {format === "STORY" ? (
            <div className="relative w-full max-w-[260px] overflow-hidden rounded-3xl bg-black">
              {media()}
              <div className="absolute inset-x-0 top-0 space-y-2 bg-gradient-to-b from-black/60 to-transparent p-3">
                <div className="flex gap-1"><i className="h-0.5 flex-1 rounded bg-white" /><i className="h-0.5 flex-1 rounded bg-white/40" /></div>
                <div className="flex items-center gap-2 text-white">{avatar(28)}<span className="text-sm font-semibold">{network === "INSTAGRAM" ? user : clientName}</span><span className="text-xs text-white/70">Ahora</span></div>
              </div>
            </div>
          ) : network === "FACEBOOK" ? (
            <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#dadde1] bg-white text-[13.5px]">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {avatar(38)}
                <div className="min-w-0"><p className="truncate font-semibold">{clientName}</p><p className="text-xs text-[#65676b]">Publicidad · Ahora · 🌐</p></div>
                <span className="ml-auto text-lg text-[#65676b]">⋯</span>
              </div>
              <p className="whitespace-pre-wrap px-3 pb-2.5 leading-snug">
                {short ? `${copy.slice(0, 125).trimEnd()}… ` : copy}
                {copy.length > 125 && <button type="button" className="font-medium text-[#65676b]" onClick={() => setMore((v) => !v)}>{more ? " Ver menos" : "Ver más"}</button>}
              </p>
              {media()}
              {dots()}
              <div className="flex items-center justify-around border-t border-[#e4e6eb] py-2 text-[13px] font-semibold text-[#65676b]">
                <span className="flex items-center gap-1.5"><ThumbsUp size={16} /> Me gusta</span><span className="flex items-center gap-1.5"><MessageCircle size={16} /> Comentar</span><span className="flex items-center gap-1.5"><Share2 size={16} /> Compartir</span>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[380px] overflow-hidden rounded-xl border border-[#dbdbdb] bg-white text-[13.5px]">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {avatar(32)}
                <p className="font-semibold">{user}</p>
                <span className="ml-auto text-lg">⋯</span>
              </div>
              {media()}
              <div className="flex items-center gap-3.5 px-3 pt-2.5"><Heart size={22} /><MessageCircle size={22} /><Send size={22} /><Bookmark size={22} className="ml-auto" /></div>
              {dots()}
              <p className="px-3 pb-3 pt-1.5 leading-snug"><strong>{user}</strong>{" "}
                <span className="whitespace-pre-wrap">{copy.length > 125 && !more ? `${copy.slice(0, 125).trimEnd()}… ` : copy}</span>
                {copy.length > 125 && <button type="button" className="text-[#737373]" onClick={() => setMore((v) => !v)}>{more ? " menos" : "más"}</button>}
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          {format === "STORY" ? "En las historias el texto no se muestra debajo de la imagen: debe ir dentro del arte. " : ""}
          Simulación referencial: el aspecto final puede variar ligeramente según el dispositivo.
        </p>
        <div className="flex justify-end"><button type="button" className="btn-outline" onClick={onClose}>Cerrar</button></div>
      </div>
    </Modal>
  );
}
