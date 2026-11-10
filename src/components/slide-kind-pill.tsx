import { SLIDE_KINDS } from "@/lib/reviews";
import { cn } from "@/lib/utils";

/** Pill del tipo de slide (BANNER, VIDEO, CARRUSEL o AD) con su color. No muestra nada si el slide aún no tiene tipo. */
export function SlideKindPill({ kind, className }: { kind: string | null | undefined; className?: string }) {
  const k = SLIDE_KINDS.find((x) => x.value === kind);
  if (!k) return null;
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide", k.style, className)}>{k.value}</span>;
}
