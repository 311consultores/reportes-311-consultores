import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ImageIcon, Info, Video } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { META_ROLES } from "@/lib/roles";
import { accessibleAccounts, isDemo, listAdSets, listAds, listCampaigns, type MetaAd, type MetaAdSet, type MetaCampaign } from "@/lib/meta";
import { CTA, LAYERS, OBJECTIVES, OPTIMIZATION, SPECIAL_CATEGORIES, STATUS, label, money } from "@/lib/meta-glossary";
import { formatMx } from "@/lib/tasks-shared";
import { cn } from "@/lib/utils";
import { ExplainBox } from "../explain-box";

export const metadata = { title: "Campañas Meta | Portal de Operaciones" };

const TONE = { ok: "bg-[#34C759]/15 text-[#1E7B3A] dark:text-[#6EE7A0]", warn: "bg-[#FF9500]/15 text-[#B25E00] dark:text-[#FFB340]", off: "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300", bad: "bg-[#FF3B30]/12 text-[#D70015] dark:text-[#FF6A60]" } as const;

function Chip({ status }: { status: string }) {
  const st = STATUS[status] ?? { label: status || "—", tone: "off" as const, help: "" };
  return <span title={st.help} className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[st.tone])}>{st.label}</span>;
}

const Help = ({ children }: { children: React.ReactNode }) => (
  <p className="flex items-start gap-2 rounded-xl bg-[#007AFF]/8 px-3.5 py-2.5 text-sm text-zinc-700 dark:text-zinc-200"><Info size={16} className="mt-0.5 shrink-0 text-[#007AFF]" /><span>{children}</span></p>
);

const date = (d: string | null) => (d ? formatMx(d, false) : "—");
const budgetOf = (x: { dailyBudget: string | null; lifetimeBudget: string | null }, cur: string) =>
  x.dailyBudget ? `${money(x.dailyBudget, cur)} al día` : x.lifetimeBudget ? `${money(x.lifetimeBudget, cur)} en total` : "Lo define el conjunto de anuncios";

const GENDER: Record<number, string> = { 1: "hombres", 2: "mujeres" };

function describeTargeting(t: MetaAdSet["targeting"]): string[] {
  const out: string[] = [];
  if (t.ageMin || t.ageMax) out.push(`Edad: ${t.ageMin ?? 18} a ${t.ageMax ?? "65+"} años`);
  if (t.genders?.length) out.push(`Solo ${t.genders.map((g) => GENDER[g] ?? "").filter(Boolean).join(" y ")}`);
  const where = [...t.cities, ...t.countries].filter(Boolean);
  if (where.length) out.push(`Lugares: ${where.join(", ")}`);
  if (t.interests.length) out.push(`Intereses: ${t.interests.join(", ")}`);
  if (t.platforms.length) out.push(`Dónde se muestra: ${t.platforms.map((p) => (p === "facebook" ? "Facebook" : p === "instagram" ? "Instagram" : p)).join(" y ")}`);
  return out.length ? out : ["Público amplio (sin filtros especiales)"];
}

export default async function MetaAccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string; s?: string }> }) {
  const user = await requireUser(META_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const account = (await accessibleAccounts(user)).find((a) => a.id === id);
  if (!account) notFound();
  const cur = account.currency ?? "MXN";
  const title = account.client?.companyName ?? account.name;

  let error: string | undefined;
  let campaigns: MetaCampaign[] = [];
  let adsets: MetaAdSet[] = [];
  let ads: MetaAd[] = [];
  try {
    campaigns = await listCampaigns(account.adAccountId);
    if (sp.c && campaigns.some((c) => c.id === sp.c)) adsets = await listAdSets(sp.c);
    if (sp.c && sp.s && adsets.some((s) => s.id === sp.s)) ads = await listAds(sp.s);
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudo consultar Meta";
  }
  const campaign = campaigns.find((c) => c.id === sp.c);
  const adset = adsets.find((s) => s.id === sp.s);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Dónde estás">
        <Link href="/meta" className="link">Campañas Meta</Link><ChevronRight size={14} className="text-zinc-400" />
        <Link href={`/meta/${id}`} className={cn(campaign ? "link" : "font-semibold")}>{title}</Link>
        {campaign && <><ChevronRight size={14} className="text-zinc-400" /><Link href={`/meta/${id}?c=${campaign.id}`} className={cn(adset ? "link" : "font-semibold")}>{campaign.name}</Link></>}
        {adset && <><ChevronRight size={14} className="text-zinc-400" /><span className="font-semibold">{adset.name}</span></>}
      </nav>

      {isDemo() && <p className="rounded-xl bg-[#FF9500]/10 px-4 py-2 text-sm text-[#B25E00] dark:text-[#FFB340]">Modo demostración: datos de ejemplo.</p>}
      {error && <p className="rounded-xl bg-[#FF3B30]/10 px-4 py-3 text-sm text-[#D70015] dark:text-[#FF6A60]" role="alert">{error}</p>}

      {/* Capa 1: campañas */}
      {!campaign && !error && (
        <section className="space-y-3">
          <h1 className="page-title">{title}</h1>
          <Help><b>{LAYERS.campaign.title}s.</b> {LAYERS.campaign.help} Elige una campaña para ver sus conjuntos de anuncios.</Help>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <article key={c.id} className="card space-y-2">
                <Link href={`/meta/${id}?c=${c.id}`} className="flex flex-wrap items-center gap-2 hover:opacity-80">
                  <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{c.name}</h2>
                  <Chip status={c.effectiveStatus} />
                  <ChevronRight size={16} className="text-zinc-400" />
                </Link>
                <p className="text-sm"><b>Objetivo:</b> {label(OBJECTIVES, c.objective)} · <b>Presupuesto:</b> {budgetOf(c, cur)}</p>
                <p className="meta text-xs">{OBJECTIVES[c.objective ?? ""]?.help}</p>
                {c.specialCategories.length > 0 && (
                  <p className="rounded-lg bg-[#FF9500]/10 px-3 py-1.5 text-xs text-[#B25E00] dark:text-[#FFB340]">⚠ Categoría especial: {c.specialCategories.map((x) => SPECIAL_CATEGORIES[x] ?? x).join(", ")}. Meta limita aquí cómo se puede segmentar y revisa los textos con más cuidado.</p>
                )}
                <p className="meta text-xs">Desde {date(c.startTime)}{c.stopTime ? ` hasta ${date(c.stopTime)}` : " · sin fecha de término"}</p>
                <ExplainBox layer="campaign" accountId={id} data={c} />
              </article>
            ))}
            {campaigns.length === 0 && <p className="card meta">Esta cuenta no tiene campañas activas ni pausadas.</p>}
          </div>
        </section>
      )}

      {/* Capa 2: conjuntos */}
      {campaign && !adset && !error && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><h1 className="page-title mr-auto">{campaign.name}</h1><Chip status={campaign.effectiveStatus} /></div>
          <Help><b>{LAYERS.adset.title}s.</b> {LAYERS.adset.help} Elige uno para ver sus anuncios.</Help>
          <ExplainBox layer="campaign" accountId={id} data={campaign} label="Explícame esta campaña" />
          <div className="space-y-3">
            {adsets.map((s) => (
              <article key={s.id} className="card space-y-2">
                <Link href={`/meta/${id}?c=${campaign.id}&s=${s.id}`} className="flex flex-wrap items-center gap-2 hover:opacity-80">
                  <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{s.name}</h2>
                  <Chip status={s.effectiveStatus} />
                  <ChevronRight size={16} className="text-zinc-400" />
                </Link>
                <p className="text-sm"><b>Presupuesto:</b> {budgetOf(s, cur)} · <b>Busca:</b> {OPTIMIZATION[s.optimizationGoal ?? ""] ?? s.optimizationGoal ?? "—"}</p>
                <ul className="list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">{describeTargeting(s.targeting).map((t) => <li key={t}>{t}</li>)}</ul>
                <p className="meta text-xs">Desde {date(s.startTime)}{s.endTime ? ` hasta ${date(s.endTime)}` : " · sin fecha de término"}</p>
                <ExplainBox layer="adset" accountId={id} data={s} />
              </article>
            ))}
            {adsets.length === 0 && <p className="card meta">Esta campaña no tiene conjuntos de anuncios.</p>}
          </div>
        </section>
      )}

      {/* Capa 3: anuncios */}
      {campaign && adset && !error && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><h1 className="page-title mr-auto">{adset.name}</h1><Chip status={adset.effectiveStatus} /></div>
          <Help><b>{LAYERS.ad.title}s.</b> {LAYERS.ad.help}</Help>
          <ExplainBox layer="adset" accountId={id} data={adset} label="Explícame este conjunto" />
          <div className="grid gap-3 lg:grid-cols-2">
            {ads.map((a) => (
              <article key={a.id} className="card space-y-3">
                <div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{a.name}</h2><Chip status={a.effectiveStatus} /></div>
                <div className="flex gap-3">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/[0.05] text-zinc-400 dark:bg-white/[0.06]">
                    {a.creative.thumbnailUrl || a.creative.imageUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={(a.creative.thumbnailUrl ?? a.creative.imageUrl) as string} alt="" className="h-full w-full object-cover" />
                      : a.creative.videoId ? <Video size={26} /> : <ImageIcon size={26} />}
                  </div>
                  <dl className="min-w-0 space-y-1 text-sm">
                    <div><dt className="text-xs text-zinc-500">Título</dt><dd className="font-medium">{a.creative.title ?? "—"}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Texto principal</dt><dd>{a.creative.body ?? "—"}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Botón</dt><dd>{label(CTA, a.creative.cta)}</dd></div>
                    {a.creative.link && <div><dt className="text-xs text-zinc-500">Enlace</dt><dd className="truncate"><a className="link" href={a.creative.link} target="_blank" rel="noopener noreferrer">{a.creative.link}</a></dd></div>}
                  </dl>
                </div>
                <ExplainBox layer="ad" accountId={id} data={a} />
              </article>
            ))}
            {ads.length === 0 && <p className="card meta">Este conjunto no tiene anuncios.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
