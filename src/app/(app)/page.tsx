import Link from "next/link";
import { Plus } from "lucide-react";
import type { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, reportScope, canEdit } from "@/lib/auth";
import { StatusBadge, STATUS_LABEL } from "@/components/status-badge";

const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  const { status: statusParam } = await searchParams;
  const status = (Object.keys(STATUS_LABEL) as ReportStatus[]).find((s) => s === statusParam);

  const reports = await prisma.report.findMany({
    where: { ...reportScope(user), ...(status ? { status } : {}) },
    include: { client: true, project: true, _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });

  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] ${active ? "bg-[#007AFF] text-white shadow-sm" : "glass text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Reportes</h1>
        {canEdit(user.role) && (
          <Link href="/reportes/nuevo" className="btn"><Plus size={16} /> Nuevo reporte</Link>
        )}
      </div>

      {user.role !== "CLIENTE" && (
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={tab(!status)}>Todos</Link>
          {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((s) => (
            <Link key={s} href={`/?status=${s}`} className={tab(status === s)}>{STATUS_LABEL[s]}</Link>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr>
              <th className="th">Folio</th><th className="th">Cliente</th><th className="th">Proyecto</th>
              <th className="th">Periodo</th><th className="th">Actividades</th><th className="th">Estado</th>
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
