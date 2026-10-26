import type { MetaAd, MetaAdAccount, MetaAdSet, MetaCampaign } from "@/lib/meta";

/** Datos de ejemplo para probar el panel sin conectar con Meta (solo en desarrollo, con META_DEMO=true). */

export const DEMO_ACCOUNTS: MetaAdAccount[] = [
  { adAccountId: "act_1001", name: "Clínica Santa Aurora (demo)", currency: "MXN", status: 1 },
  { adAccountId: "act_1002", name: "Constructora Horizonte (demo)", currency: "MXN", status: 1 },
  { adAccountId: "act_1003", name: "Estudio Creativo (demo)", currency: "MXN", status: 2 },
];

const CAMPAIGNS: Record<string, MetaCampaign[]> = {
  act_1001: [
    { id: "c1", name: "Citas dentales · Leads", status: "ACTIVE", effectiveStatus: "ACTIVE", objective: "OUTCOME_LEADS", dailyBudget: "25000", lifetimeBudget: null, startTime: "2026-09-01T00:00:00-0600", stopTime: null, specialCategories: [] },
    { id: "c2", name: "WhatsApp · Consulta general", status: "PAUSED", effectiveStatus: "PAUSED", objective: "OUTCOME_ENGAGEMENT", dailyBudget: "15000", lifetimeBudget: null, startTime: "2026-08-10T00:00:00-0600", stopTime: null, specialCategories: [] },
  ],
  act_1002: [
    { id: "c3", name: "Departamentos Torre Norte", status: "ACTIVE", effectiveStatus: "WITH_ISSUES", objective: "OUTCOME_LEADS", dailyBudget: "50000", lifetimeBudget: null, startTime: "2026-10-01T00:00:00-0600", stopTime: "2026-12-31T00:00:00-0600", specialCategories: ["HOUSING"] },
  ],
  act_1003: [],
};

const ADSETS: Record<string, MetaAdSet[]> = {
  c1: [
    { id: "s1", campaignId: "c1", name: "Mujeres 25-45 · CDMX", status: "ACTIVE", effectiveStatus: "ACTIVE", dailyBudget: "15000", lifetimeBudget: null, optimizationGoal: "LEAD_GENERATION", startTime: "2026-09-01T00:00:00-0600", endTime: null, targeting: { ageMin: 25, ageMax: 45, genders: [2], countries: ["MX"], cities: ["Ciudad de México"], interests: ["Salud dental", "Bienestar"], platforms: ["facebook", "instagram"], placements: ["feed", "story"] } },
    { id: "s2", campaignId: "c1", name: "Amplio 18-55 · Edomex", status: "PAUSED", effectiveStatus: "PAUSED", dailyBudget: "10000", lifetimeBudget: null, optimizationGoal: "LEAD_GENERATION", startTime: "2026-09-01T00:00:00-0600", endTime: null, targeting: { ageMin: 18, ageMax: 55, countries: ["MX"], cities: ["Naucalpan", "Toluca"], interests: [], platforms: ["facebook", "instagram"], placements: [] } },
  ],
  c2: [
    { id: "s3", campaignId: "c2", name: "Recontacto · mensajes", status: "PAUSED", effectiveStatus: "PAUSED", dailyBudget: "15000", lifetimeBudget: null, optimizationGoal: "CONVERSATIONS", startTime: "2026-08-10T00:00:00-0600", endTime: null, targeting: { ageMin: 21, ageMax: 60, countries: ["MX"], cities: [], interests: ["Medicina"], platforms: ["instagram"], placements: ["feed"] } },
  ],
  c3: [
    { id: "s4", campaignId: "c3", name: "Interesados en vivienda · CDMX", status: "ACTIVE", effectiveStatus: "WITH_ISSUES", dailyBudget: "50000", lifetimeBudget: null, optimizationGoal: "LEAD_GENERATION", startTime: "2026-10-01T00:00:00-0600", endTime: "2026-12-31T00:00:00-0600", targeting: { countries: ["MX"], cities: ["Ciudad de México"], interests: [], platforms: ["facebook", "instagram"], placements: [] } },
  ],
};

const ADS: Record<string, MetaAd[]> = {
  s1: [
    { id: "a1", adsetId: "s1", name: "Limpieza dental · imagen", status: "ACTIVE", effectiveStatus: "ACTIVE", creative: { id: "cr1", title: "Tu sonrisa merece lo mejor", body: "Agenda hoy tu limpieza dental con especialistas. Primera valoración sin costo.", thumbnailUrl: null, imageUrl: null, videoId: null, cta: "SIGN_UP", link: "https://ejemplo.mx/citas" } },
    { id: "a2", adsetId: "s1", name: "Ortodoncia · video", status: "ACTIVE", effectiveStatus: "ACTIVE", creative: { id: "cr2", title: "Brackets desde $999 al mes", body: "Conoce nuestros planes de ortodoncia. Cupo limitado este mes.", thumbnailUrl: null, imageUrl: null, videoId: "v123", cta: "LEARN_MORE", link: "https://ejemplo.mx/ortodoncia" } },
  ],
  s2: [{ id: "a3", adsetId: "s2", name: "Blanqueamiento", status: "PAUSED", effectiveStatus: "PAUSED", creative: { id: "cr3", title: "Sonríe sin manchas", body: "Blanqueamiento profesional en una sola visita.", thumbnailUrl: null, imageUrl: null, videoId: null, cta: "CONTACT_US", link: "https://ejemplo.mx/blanqueamiento" } }],
  s3: [{ id: "a4", adsetId: "s3", name: "Escríbenos por WhatsApp", status: "PAUSED", effectiveStatus: "PAUSED", creative: { id: "cr4", title: "¿Dudas? Escríbenos", body: "Resolvemos tus dudas por WhatsApp en minutos.", thumbnailUrl: null, imageUrl: null, videoId: null, cta: "WHATSAPP_MESSAGE", link: null } }],
  s4: [{ id: "a5", adsetId: "s4", name: "Torre Norte · render", status: "ACTIVE", effectiveStatus: "DISAPPROVED", creative: { id: "cr5", title: "Vive en Torre Norte", body: "Departamentos desde $2.4 millones. Agenda tu visita y conoce los acabados.", thumbnailUrl: null, imageUrl: null, videoId: null, cta: "LEARN_MORE", link: "https://ejemplo.mx/torre-norte" } }],
};

export const demoCampaigns = (acc: string) => CAMPAIGNS[acc] ?? [];
export const demoAdSets = (campaignId: string) => ADSETS[campaignId] ?? [];
export const demoAds = (adsetId: string) => ADS[adsetId] ?? [];
