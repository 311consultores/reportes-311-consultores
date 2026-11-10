/** Reembolsos del TEAM 311 (Evolutivo 19). */
export const URGENCIES = [
  { value: "URGE", label: "Urge porfitas" },
  { value: "SABADO", label: "Awanto para el sábado" },
] as const;
export type Urgency = (typeof URGENCIES)[number]["value"];
export const isUrgency = (v: unknown): v is Urgency => URGENCIES.some((u) => u.value === v);
export const urgencyLabel = (v: string) => URGENCIES.find((u) => u.value === v)?.label ?? v;

export type ReimbStatus = "SOLICITADO" | "APROBADO" | "RECHAZADO" | "PAGADO";
export const STATUS_LABEL: Record<ReimbStatus, string> = { SOLICITADO: "Solicitado", APROBADO: "Aprobado", RECHAZADO: "Rechazado", PAGADO: "Pagado" };
export const STATUS_COLOR: Record<ReimbStatus, string> = { SOLICITADO: "#FF9500", APROBADO: "#007AFF", RECHAZADO: "#FF3B30", PAGADO: "#34C759" };

export const MAX_RECEIPT = 10 * 1024 * 1024; // 10 MB
