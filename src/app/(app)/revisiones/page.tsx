import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/finance";
import { clientView, REVIEW_CREATORS, REVIEW_STATUS_LABEL, REVIEW_STATUS_STYLE, reviewScope } from "@/lib/reviews";
import { ReviewThumb } from "@/components/review-thumb";
import { cn } from "@/lib/utils";

export const metadata = { title: "Revisiones | Portal de Operaciones" };

const include = {
  client: { select: { companyName: true } },
  project: { select: { projectName: true } },
  copyUser: { select: { name: true } },
  artUser: { select: { name: true } },
  slides: { orderBy: { position: "asc" as const }, select: { id: true, status: true, assets: { orderBy: { position: "asc" as const }, take: 1, select: { id: true, type: true } } } },
} satisfies Prisma.ReviewInclude;

const Chip = ({ text, style }: { text: string; style: string }) => <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", style)}>{text}</span>;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (user.role === "CLIENTE") return <ClientList user={user} tab={String((await searchParams).tab ?? "pendientes")} />;
  if (!["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"].includes(user.role)) return null;

  const estado = String((await searchParams).estado ?? "todas");
  const where: Prisma.ReviewWhereInput = { ...reviewScope(user), ...(estado !== "todas" && estado in REVIEW_STATUS_LABEL ? { status: estado as ReviewStatus } : {}) };
  const reviews = await prisma.review.findMany({ where, include, orderBy: { updatedAt: "desc" }, take: 200 });
  const counts = await prisma.review.groupBy({ by: ["status"], where: reviewScope(user), _count: true });
  const n = (s: ReviewStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const tabs: [string, string][] = [["todas", "Todas"], ["BORRADOR", `Borradores · ${n("BORRADOR")}`], ["PUBLICADA", `Esperando al cliente · ${n("PUBLICADA")}`], ["EN_AJUSTES", `Ajustes por hacer · ${n("EN_AJUSTES")}`], ["APROBADA", `Aprobadas · ${n("APROBADA")}`]];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Revisiones</h1>
          <p className="meta">Parrillas de copys y artes que el cliente revisa y aprueba desde su panel.</p>
        </div>
        {REVIEW_CREATORS.includes(user.role) && <Link href="/revisiones/nueva" className="btn"><Plus size={16} /> Nueva revisión</Link>}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([v, label]) => (
          <Link key={v} href={`/revisiones?estado=${v}`} className={cn("rounded-full border px-3.5 py-1.5 text-sm", estado === v ? "border-transparent bg-foreground text-background" : "border-black/10 dark:border-white/15")}>{label}</Link>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr><th className="th">Revisión</th><th className="th">Cliente</th><th className="th">Estado</th><th className="th">Ronda</th><th className="th">Avance</th><th className="th">Responsables</th><th className="th">Responder antes de</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {reviews.map((r) => {
              const done = r.slides.filter((s) => s.status === "APROBADO").length;
              return (
                <tr key={r.id}>
                  <td className="td"><Link href={`/revisiones/${r.id}`} className="font-medium">{r.title}</Link><span className="block text-xs text-zinc-500">{r.slides.length} slide(s)</span></td>
                  <td className="td">{r.client.companyName}<span className="block text-xs text-zinc-500">{r.project.projectName}</span></td>
                  <td className="td"><Chip text={REVIEW_STATUS_LABEL[r.status]} style={REVIEW_STATUS_STYLE[r.status]} /></td>
                  <td className="td">{r.status === "BORRADOR" ? "—" : r.round}</td>
                  <td className="td min-w-[110px]">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><div className="h-full rounded-full bg-[#34C759]" style={{ width: `${r.slides.length ? (done / r.slides.length) * 100 : 0}%` }} /></div>
                    <span className="text-xs text-zinc-500">{done} de {r.slides.length}</span>
                  </td>
                  <td className="td text-xs"><span className="text-zinc-500">Copy:</span> {r.copyUser?.name ?? "—"}<br /><span className="text-zinc-500">Arte:</span> {r.artUser?.name ?? "—"}</td>
                  <td className="td whitespace-nowrap">{r.respondBy ? fmtDate(r.respondBy) : "—"}</td>
                  <td className="td"><Link href={`/revisiones/${r.id}`} className="btn-outline px-3 py-1.5 text-xs">{r.status === "BORRADOR" ? "Continuar" : "Abrir"}</Link></td>
                </tr>
              );
            })}
            {reviews.length === 0 && <tr><td colSpan={8} className="td py-10 text-center text-zinc-500">Todavía no hay revisiones en esta vista.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function ClientList({ user, tab }: { user: Awaited<ReturnType<typeof requireUser>>; tab: string }) {
  const all = await prisma.review.findMany({ where: reviewScope(user), include, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] });
  const groups = { pendientes: all.filter((r) => r.status === "PUBLICADA"), ajustes: all.filter((r) => r.status === "EN_AJUSTES"), aprobadas: all.filter((r) => r.status === "APROBADA") };
  const key = tab in groups ? (tab as keyof typeof groups) : "pendientes";
  const list = groups[key];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Revisiones</h1>
        <p className="meta">Aquí revisas los copys y artes que preparamos para tus redes sociales.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([["pendientes", "Por revisar"], ["ajustes", "En ajustes"], ["aprobadas", "Aprobadas"]] as const).map(([k, label]) => (
          <Link key={k} href={`/revisiones?tab=${k}`} className={cn("rounded-full border px-3.5 py-1.5 text-sm", key === k ? "border-transparent bg-foreground text-background" : "border-black/10 dark:border-white/15")}>{label} · {groups[k].length}</Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => {
          const v = clientView(r);
          const done = r.slides.filter((s) => s.status === "APROBADO").length;
          return (
            <article key={r.id} className="card flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => <ReviewThumb key={i} asset={r.slides[i]?.assets[0]} index={i} className="h-16" />)}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate font-semibold tracking-tight">{r.title}</h2><p className="meta truncate">{r.project.projectName}</p></div>
                <Chip text={v.label} style={v.style} />
              </div>
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><div className="h-full rounded-full bg-[#34C759]" style={{ width: `${r.slides.length ? (done / r.slides.length) * 100 : 0}%` }} /></div>
                <p className="mt-1 text-xs text-zinc-500">{r.slides.length} slide(s) · {done} aprobado(s){r.round > 1 ? ` · Ronda ${r.round}` : ""}</p>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3">
                <span className="meta">{r.status === "PUBLICADA" && r.respondBy ? <>Responder antes del <strong className="text-foreground">{fmtDate(r.respondBy)}</strong></> : ""}</span>
                <Link href={`/revisiones/${r.id}`} className={cn("px-3.5 py-2 text-sm", r.status === "PUBLICADA" ? "btn" : "btn-outline")}>{v.button}</Link>
              </div>
            </article>
          );
        })}
        {list.length === 0 && <p className="card meta sm:col-span-2 xl:col-span-3">No hay revisiones en esta sección.</p>}
      </div>
    </div>
  );
}
