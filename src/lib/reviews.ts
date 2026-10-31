import type { Prisma, ReviewStatus, Role, SlideStatus } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";

// ---------- Textos y límites ----------
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  BORRADOR: "Borrador",
  PUBLICADA: "Esperando al cliente",
  EN_AJUSTES: "Ajustes por hacer",
  APROBADA: "Aprobada",
};

export const SLIDE_STATUS_LABEL: Record<SlideStatus, string> = {
  PENDIENTE: "Pendiente de revisión",
  CAMBIOS: "Cambios solicitados",
  AJUSTADO: "Ajustado · por revisar",
  APROBADO: "Aprobado",
};

/** Colores de cada estado de slide (texto y fondo), iguales en todas las pantallas. */
export const SLIDE_STATUS_STYLE: Record<SlideStatus, string> = {
  PENDIENTE: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  CAMBIOS: "bg-[#FF9500]/15 text-[#C93400] dark:text-[#FF9F0A]",
  AJUSTADO: "bg-[#007AFF]/10 text-[#0062CC] dark:text-[#4DA3FF]",
  APROBADO: "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]",
};

export const CHANNELS = [
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
] as const;
export const channelLabel = (v: string) => CHANNELS.find((c) => c.value === v)?.label ?? v;

export const MAX_COPY = 2200; // límite de caracteres de Instagram
export const MAX_ASSETS = 10; // imágenes de un carrusel
export const MAX_COMMENT = 2000;
export const MB = 1024 * 1024;
export const ASSET_TYPES: Record<string, { type: "IMAGE" | "VIDEO"; ext: string; max: number }> = {
  "image/jpeg": { type: "IMAGE", ext: "jpg", max: 8 * MB },
  "image/png": { type: "IMAGE", ext: "png", max: 8 * MB },
  "video/mp4": { type: "VIDEO", ext: "mp4", max: 100 * MB },
  "video/webm": { type: "VIDEO", ext: "webm", max: 100 * MB },
  "video/quicktime": { type: "VIDEO", ext: "mov", max: 100 * MB },
};

/** Segundos → «0:12». */
export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** «1:05» o «65» → segundos (null si no es válido). */
export function parseSec(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,3}):([0-5]\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return /^\d{1,5}$/.test(t) ? Number(t) : null;
}

// ---------- Permisos ----------
export const REVIEW_STAFF: Role[] = ["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"];
export const REVIEW_CREATORS: Role[] = ["ADMIN", "EDITOR", "PROJECT_311"];

/** Revisiones que puede ver cada persona: el cliente, solo las publicadas de su empresa; el TEAM 311, las de sus proyectos. */
export function reviewScope(user: CurrentUser): Prisma.ReviewWhereInput {
  if (user.role === "CLIENTE") return { clientId: { in: user.clientAccess.map((c) => c.clientId) }, status: { not: "BORRADOR" } };
  // El TEAM 311 ve las revisiones de sus proyectos y las que le tocan atender (copy o arte)
  if (user.role === "TEAM_311") return { OR: [{ projectId: { in: user.projectAccess.map((p) => p.projectId) } }, { copyUserId: user.id }, { artUserId: user.id }] };
  return {};
}

/** Tipo de arte de un slide según sus archivos. */
export function artKind(assets: { type: string }[]): "NONE" | "IMAGE" | "VIDEO" | "CAROUSEL" {
  if (assets.length === 0) return "NONE";
  if (assets[0].type === "VIDEO") return "VIDEO";
  return assets.length > 1 ? "CAROUSEL" : "IMAGE";
}

export const ART_KIND_LABEL = { NONE: "Sin arte", IMAGE: "Imagen", VIDEO: "Video", CAROUSEL: "Carrusel" } as const;

export const assetUrl = (id: string) => `/api/revisiones/archivo/${id}`;

export const REVIEW_STATUS_STYLE: Record<ReviewStatus, string> = {
  BORRADOR: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  PUBLICADA: "bg-[#007AFF]/10 text-[#0062CC] dark:text-[#4DA3FF]",
  EN_AJUSTES: "bg-[#FF9500]/15 text-[#C93400] dark:text-[#FF9F0A]",
  APROBADA: "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]",
};

/** Cómo ve el cliente el estado de una revisión: etiqueta y botón. */
export function clientView(r: { status: ReviewStatus; round: number; startedAt: Date | null }): { label: string; style: string; button: string } {
  if (r.status === "APROBADA") return { label: "Aprobada", style: REVIEW_STATUS_STYLE.APROBADA, button: "Ver revisión" };
  if (r.status === "EN_AJUSTES") return { label: "En ajustes", style: REVIEW_STATUS_STYLE.EN_AJUSTES, button: "Ver avance" };
  if (r.round > 1) return { label: "Ajustado · por revisar", style: SLIDE_STATUS_STYLE.AJUSTADO, button: "Revisar ajustes" };
  if (r.startedAt) return { label: "Revisión en curso", style: REVIEW_STATUS_STYLE.PUBLICADA, button: "Continuar revisión" };
  return { label: "Pendiente de revisión", style: SLIDE_STATUS_STYLE.PENDIENTE, button: "Iniciar revisión" };
}

/** Mensaje de WhatsApp para avisar al grupo del cliente que los ajustes están listos. */
export function reviewWhatsappMessage(clientName: string, types: { copy: boolean; art: boolean }, title: string, link: string) {
  const what = types.copy && types.art ? "COPY y ARTE" : types.copy ? "COPY" : "ARTE";
  return `¡Hola Equipo ${clientName}! Los ajustes de ${what} de ${title} están listos, puede revisarlo en el siguiente link: ${link}`;
}
