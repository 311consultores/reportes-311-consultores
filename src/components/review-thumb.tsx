import { assetUrl } from "@/lib/reviews";
import { cn } from "@/lib/utils";

const FALLBACKS = [
  "from-[#3b6cf5] to-[#7a3df0]", "from-[#0f9d73] to-[#12a8e6]", "from-[#f06a1d] to-[#e0307a]",
  "from-[#f5b82e] to-[#f0742c]", "from-[#2c3e6b] to-[#4f7bd6]", "from-[#8e44ad] to-[#e84393]",
];

/** Miniatura de un slide: la primera imagen o el primer cuadro del video; si no hay arte, un color con el número. */
export function ReviewThumb({ asset, index = 0, className, fit = "cover" }: { asset?: { id: string; type: string } | null; index?: number; className?: string; fit?: "cover" | "contain" }) {
  const box = cn("overflow-hidden rounded-lg bg-black/5 dark:bg-white/10", className);
  if (!asset) return <div className={cn(box, "flex items-center justify-center bg-gradient-to-br text-sm font-semibold text-white/90", FALLBACKS[index % FALLBACKS.length])}>{index + 1}</div>;
  if (asset.type === "VIDEO") return <div className={box}><video src={`${assetUrl(asset.id)}#t=0.5`} preload="metadata" muted playsInline className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")} /></div>;
  return (
    <div className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- los archivos salen de una ruta protegida de la propia app */}
      <img src={assetUrl(asset.id)} alt="" loading="lazy" className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")} />
    </div>
  );
}
