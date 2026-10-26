import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth";

/**
 * Conexión con la API de Marketing de Meta (Graph API). Solo lectura en la Etapa 1.
 * El token del «usuario del sistema» vive únicamente en la variable META_ACCESS_TOKEN del servidor.
 * Con META_DEMO=true (solo en desarrollo) se usan datos de ejemplo para probar sin conectar con Meta.
 */

export const META_VERSION = process.env.META_API_VERSION || "v23.0";
const BASE = `https://graph.facebook.com/${META_VERSION}`;

export const isDemo = () => process.env.META_DEMO === "true" && process.env.NODE_ENV !== "production";
export const hasToken = () => !!process.env.META_ACCESS_TOKEN?.trim();
export const metaReady = () => isDemo() || hasToken();

export class MetaError extends Error {
  constructor(message: string, public code?: number) { super(message); }
}

/** Mensajes de error de Meta traducidos a algo que una persona sin experiencia pueda entender. */
function friendly(code: number | undefined, msg: string): string {
  if (code === 190) return "El acceso a Meta venció o fue revocado. Pide al Administrador que genere un token nuevo.";
  if (code === 200 || code === 10 || code === 283) return "Meta no permite esta acción con los permisos actuales de la conexión. Revisa que el usuario del sistema tenga asignada la cuenta publicitaria.";
  if (code === 4 || code === 17 || code === 32 || code === 613) return "Meta limitó temporalmente las consultas (demasiadas en poco tiempo). Intenta de nuevo en unos minutos.";
  if (code === 100) return `Meta rechazó la solicitud: ${msg}`;
  return `Meta respondió con un error: ${msg}`;
}

async function metaGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new MetaError("Falta conectar Meta: el Administrador debe configurar META_ACCESS_TOKEN.");
  const url = new URL(`${BASE}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_user_msg?: string } } & T;
  if (!res.ok || json.error) throw new MetaError(friendly(json.error?.code, json.error?.error_user_msg || json.error?.message || res.statusText), json.error?.code);
  return json as T;
}

/** Recorre todas las páginas de un listado de Meta (máximo 10 páginas por seguridad). */
async function metaList<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const out: T[] = [];
  let page = await metaGet<{ data: T[]; paging?: { next?: string; cursors?: { after?: string } } }>(path, { limit: 100, ...params });
  out.push(...page.data);
  for (let i = 0; i < 9 && page.paging?.next && page.paging.cursors?.after; i++) {
    page = await metaGet(path, { limit: 100, ...params, after: page.paging.cursors.after });
    out.push(...page.data);
  }
  return out;
}

// ---------- Tipos normalizados ----------

export type MetaAdAccount = { adAccountId: string; name: string; currency: string | null; status: number | null };
export type MetaCampaign = {
  id: string; name: string; status: string; effectiveStatus: string; objective: string | null;
  dailyBudget: string | null; lifetimeBudget: string | null; startTime: string | null; stopTime: string | null; specialCategories: string[];
};
export type MetaAdSet = {
  id: string; campaignId: string; name: string; status: string; effectiveStatus: string; dailyBudget: string | null; lifetimeBudget: string | null;
  optimizationGoal: string | null; startTime: string | null; endTime: string | null;
  targeting: { ageMin?: number; ageMax?: number; genders?: number[]; countries: string[]; cities: string[]; interests: string[]; platforms: string[]; placements: string[] };
};
export type MetaAd = {
  id: string; adsetId: string; name: string; status: string; effectiveStatus: string;
  creative: { id: string | null; title: string | null; body: string | null; thumbnailUrl: string | null; imageUrl: string | null; videoId: string | null; cta: string | null; link: string | null };
};

type Raw = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? null : String(v));
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

// ---------- Lectura ----------

export async function listAdAccounts(): Promise<MetaAdAccount[]> {
  if (isDemo()) return (await import("@/lib/meta-demo")).DEMO_ACCOUNTS;
  const rows = await metaList<Raw>("me/adaccounts", { fields: "account_id,name,currency,account_status" });
  return rows.map((r) => ({ adAccountId: `act_${s(r.account_id)}`, name: s(r.name) ?? "Sin nombre", currency: s(r.currency), status: typeof r.account_status === "number" ? r.account_status : null }));
}

export async function listCampaigns(adAccountId: string): Promise<MetaCampaign[]> {
  if (isDemo()) return (await import("@/lib/meta-demo")).demoCampaigns(adAccountId);
  const rows = await metaList<Raw>(`${adAccountId}/campaigns`, {
    fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,special_ad_categories",
    effective_status: JSON.stringify(["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES"]),
  });
  return rows.map((r) => ({
    id: s(r.id)!, name: s(r.name) ?? "Sin nombre", status: s(r.status) ?? "", effectiveStatus: s(r.effective_status) ?? s(r.status) ?? "", objective: s(r.objective),
    dailyBudget: s(r.daily_budget), lifetimeBudget: s(r.lifetime_budget), startTime: s(r.start_time), stopTime: s(r.stop_time),
    specialCategories: Array.isArray(r.special_ad_categories) ? (r.special_ad_categories as string[]).filter((c) => c !== "NONE") : [],
  }));
}

export async function listAdSets(campaignId: string): Promise<MetaAdSet[]> {
  if (isDemo()) return (await import("@/lib/meta-demo")).demoAdSets(campaignId);
  const rows = await metaList<Raw>(`${campaignId}/adsets`, {
    fields: "id,campaign_id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,start_time,end_time,targeting",
  });
  return rows.map((r) => {
    const t = (r.targeting ?? {}) as Raw;
    const geo = (t.geo_locations ?? {}) as Raw;
    const flex = arr(t.flexible_spec);
    return {
      id: s(r.id)!, campaignId: s(r.campaign_id) ?? campaignId, name: s(r.name) ?? "Sin nombre", status: s(r.status) ?? "", effectiveStatus: s(r.effective_status) ?? s(r.status) ?? "",
      dailyBudget: s(r.daily_budget), lifetimeBudget: s(r.lifetime_budget), optimizationGoal: s(r.optimization_goal), startTime: s(r.start_time), endTime: s(r.end_time),
      targeting: {
        ageMin: typeof t.age_min === "number" ? t.age_min : undefined, ageMax: typeof t.age_max === "number" ? t.age_max : undefined,
        genders: Array.isArray(t.genders) ? (t.genders as number[]) : undefined,
        countries: Array.isArray(geo.countries) ? (geo.countries as string[]) : [],
        cities: arr(geo.cities).map((c) => s(c.name) ?? ""),
        interests: flex.flatMap((f) => arr(f.interests).map((i) => s(i.name) ?? "")).filter(Boolean),
        platforms: Array.isArray(t.publisher_platforms) ? (t.publisher_platforms as string[]) : [],
        placements: [...(Array.isArray(t.facebook_positions) ? (t.facebook_positions as string[]) : []), ...(Array.isArray(t.instagram_positions) ? (t.instagram_positions as string[]) : [])],
      },
    };
  });
}

export async function listAds(adsetId: string): Promise<MetaAd[]> {
  if (isDemo()) return (await import("@/lib/meta-demo")).demoAds(adsetId);
  const rows = await metaList<Raw>(`${adsetId}/ads`, {
    fields: "id,adset_id,name,status,effective_status,creative{id,title,body,thumbnail_url,image_url,video_id,call_to_action_type,object_story_spec}",
  });
  return rows.map((r) => {
    const c = (r.creative ?? {}) as Raw;
    const spec = (c.object_story_spec ?? {}) as Raw;
    const link = (spec.link_data ?? spec.video_data ?? {}) as Raw;
    return {
      id: s(r.id)!, adsetId: s(r.adset_id) ?? adsetId, name: s(r.name) ?? "Sin nombre", status: s(r.status) ?? "", effectiveStatus: s(r.effective_status) ?? s(r.status) ?? "",
      creative: {
        id: s(c.id), title: s(c.title) ?? s(link.name) ?? s(link.title), body: s(c.body) ?? s(link.message), thumbnailUrl: s(c.thumbnail_url), imageUrl: s(c.image_url) ?? s(link.picture),
        videoId: s(c.video_id) ?? s(link.video_id), cta: s(c.call_to_action_type), link: s(link.link),
      },
    };
  });
}

/** Comprueba la conexión (nombre del usuario del sistema y número de cuentas visibles). */
export async function testConnection(): Promise<{ ok: boolean; message: string; accounts?: number }> {
  if (isDemo()) return { ok: true, message: "Modo demostración (datos de ejemplo, sin conexión real con Meta).", accounts: (await listAdAccounts()).length };
  if (!hasToken()) return { ok: false, message: "Falta configurar META_ACCESS_TOKEN en el servidor." };
  try {
    const me = await metaGet<{ name?: string }>("me", { fields: "name" });
    const accounts = await listAdAccounts();
    return { ok: true, message: `Conectado como «${me.name ?? "usuario del sistema"}».`, accounts: accounts.length };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo conectar con Meta." };
  }
}

// ---------- Acceso del portal ----------

/** Cuentas que esta persona puede ver: el Administrador todas; los demás, las que se le asignaron. */
export async function accessibleAccounts(user: CurrentUser) {
  return prisma.metaAccount.findMany({
    where: { active: true, ...(user.role === "ADMIN" ? {} : { access: { some: { userId: user.id } } }) },
    orderBy: { name: "asc" },
    include: { client: { select: { companyName: true } } },
  });
}
