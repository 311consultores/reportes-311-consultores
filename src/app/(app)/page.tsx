import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react";
import type { Prisma, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, reportScope, canEdit } from "@/lib/auth";
import { StatusBadge, STATUS_LABEL } from "@/components/status-badge";
import { ReportSearch } from "./report-search";

const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

type SortKey = "folio" | "cliente" | "proyecto" | "periodo" | "actividades" | "estado";
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "folio", label: "Folio" },
  { key: "cliente", label: "Cliente" },
  { key: "proyecto", label: "Proyecto" },
  { key: "periodo", label: "Periodo" },
  { key: "actividades", label: "Actividades" },
  { key: "estado", label: "Estado" },
];

function orderBy(sort: SortKey | undefined, dir: "asc" | "desc"): Prisma.ReportOrderByWithRelationInput[] {
  switch (sort) {
    case "folio": return [{ folio: dir }];
    case "cliente": return [{ client: { companyName: dir } }, { createdAt: "desc" }];
    case "proyecto": return [{ project: { projectName: dir } }, { createdAt: "desc" }];
    case "periodo": return [{ startDate: dir }, { endDate: dir }];
    case "actividades": return [{ tasks: { _count: dir } }, { createdAt: "desc" }];
    case "estado": return [{ status: dir }, { createdAt: "desc" }];
    default: return [{ createdAt: "desc" }]; // por defecto: el más reciente primero
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; dir?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = (Object.keys(STATUS_LABEL) as ReportStatus[]).find((s) => s === sp.status);
  const sort = COLUMNS.find((c) => c.key === sp.sort)?.key;
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";

  const reports = await prisma.report.findMany({
    where: { ...reportScope(user), ...(status ? { status } : {}) },
    include: { client: true, project: true, _count: { select: { tasks: true } } },
    orderBy: orderBy(sort, dir),
  });

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { status, sort, dir: sort ? dir : undefined, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] ${active ? "bg-[#007AFF] text-white shadow-sm" : "glass text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">Reportes</h1>
        <div className="flex items-center gap-3">
          <ReportSearch />
          {canEdit(user.role) && (
            <Link href="/reportes/nuevo" className="btn"><Plus size={16} /> Nuevo reporte</Link>
          )}
        </div>
      </div>

      {user.role !== "CLIENTE" && (
        <div className="flex flex-wrap gap-2">
          <Link href={qs({ status: undefined })} className={tab(!status)}>Todos</Link>
          {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((s) => (
            <Link key={s} href={qs({ status: s })} className={tab(status === s)}>{STATUS_LABEL[s]}</Link>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr>
              {COLUMNS.map((c) => {
                const active = sort === c.key;
                const next = active && dir === "asc" ? "desc" : "asc";
                const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} className="th" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <Link
                      href={qs({ sort: c.key, dir: next })}
                      className={`inline-flex items-center gap-1 transition-colors duration-200 hover:text-zinc-900 dark:hover:text-zinc-100 ${active ? "text-[#007AFF]" : ""}`}
                    >
                      {c.label}
                      <Icon size={13} className={active ? "" : "opacity-50"} />
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {reports.map((r) => (
              <tr key={r.id} className="transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
                <td className="td font-medium"><Link href={`/reportes/${r.id}`} className="link">{r.folio}</Link></td>
                <td className="td">{r.client.companyName}</td>
                <td className="td">{r.project.projectName}</td>
                <td className="td">{fmt(r.startDate)} – {fmt(r.endDate)}</td>
                <td className="td">{r._count.tasks}</td>
                <td className="td"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan={6} className="td py-8 text-center text-zinc-500">No hay reportes</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
