import type { ReportStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  EN_PROCESO: "En proceso",
  TERMINADO: "Terminado",
  RECHAZADO: "Rechazado",
  APROBADO: "Aprobado",
  ENVIADO: "Enviado",
};

const STYLE: Record<ReportStatus, string> = {
  EN_PROCESO: "bg-[#FF9500]/15 text-[#C93400] dark:text-[#FF9F0A]",
  TERMINADO: "bg-[#007AFF]/10 text-[#007AFF]",
  RECHAZADO: "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF453A]",
  APROBADO: "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]",
  ENVIADO: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
