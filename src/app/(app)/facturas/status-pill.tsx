import { cn } from "@/lib/utils";
import { STATUS_LABEL, type DisplayStatus } from "@/lib/finance";

export const PILL_STYLE: Record<DisplayStatus, string> = {
  ENVIADA: "bg-[#007AFF]/10 text-[#007AFF]",
  PAGADA: "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]",
  VENCIDA: "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF453A]",
};

export function StatusPill({ status, className }: { status: DisplayStatus; className?: string }) {
  return <span className={cn("rounded-full px-3 py-1 text-xs font-medium", PILL_STYLE[status], className)}>{STATUS_LABEL[status]}</span>;
}
