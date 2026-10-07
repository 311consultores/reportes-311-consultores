import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, reportScope } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { parseConsultants } from "@/lib/consultants";
import { getLogo311Key } from "@/lib/branding";
import { TaskList } from "./task-list";
import { StatusControls } from "./status-controls";
import { ReportActions } from "./report-actions";

const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

const STATUS_ES: Record<string, string> = {
  EN_PROCESO: "En proceso",
  TERMINADO: "Terminado",
  RECHAZADO: "Rechazado",
  APROBADO: "Aprobado",
  ENVIADO: "Enviado",
};

function actionLabel(action: string) {
  const num = action.match(/_(\d+)$/)?.[1];
  if (action === "CREATED_REPORT") return "Reporte creado";
  if (action.startsWith("STATUS_CHANGE_")) return `Estado: ${STATUS_ES[action.slice(14)] ?? action.slice(14)}`;
  if (action.startsWith("EDITED_TASK_")) return `Editó la actividad ${num}`;
  if (action.startsWith("ADDED_TASK_")) return `Agregó la actividad ${num}`;
  if (action.startsWith("DELETED_TASK_")) return `Eliminó la actividad ${num}`;
  if (action.startsWith("UPLOADED_EVIDENCE_TASK_")) return `Subió evidencia a la actividad ${num}`;
  if (action.startsWith("REMOVED_EVIDENCE_TASK_")) return `Quitó la evidencia de la actividad ${num}`;
  return action;
}

function detailReason(details: string | null): string | null {
  if (!details) return null;
  try {
    const v = JSON.parse(details) as { reason?: unknown };
    return typeof v.reason === "string" ? v.reason : null;
  } catch {
    return null;
  }
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const report = await prisma.report.findFirst({
    where: { id, ...reportScope(user) },
    include: {
      client: true,
      project: true,
      createdBy: { select: { name: true } },
      tasks: { orderBy: { sequentialNum: "asc" }, include: { evidences: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!report) notFound();

  const editable =
    user.role !== "CLIENTE" && (report.status === "EN_PROCESO" || report.status === "RECHAZADO");
  const isAdmin = user.role === "ADMIN";

  const logo311Key = await getLogo311Key();
  const hasLogo311 = !!logo311Key;

  const history =
    user.role === "CLIENTE"
      ? []
      : await prisma.auditLog.findMany({
          where: { reportId: report.id },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        });

  const pending = await prisma.deletionRequest.findMany({
    where: {
      status: "PENDIENTE",
      OR: [
        { targetType: "REPORT", targetId: report.id },
        { targetType: "TASK", targetId: { in: report.tasks.map((t) => t.id) } },
      ],
    },
    select: { targetType: true, targetId: true },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/" className="btn-outline inline-flex">
        <ArrowLeft size={16} /> Reportes
      </Link>

      <div className="card space-y-3">
        {(hasLogo311 || report.client.logoUrl) && (
          <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-4 dark:border-white/10">
            {hasLogo311 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/branding/logo?v=${encodeURIComponent(logo311Key ?? "")}`} alt="311 Consultores" className="max-h-12 max-w-[180px] object-contain" />
            ) : <span />}
            {report.client.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/clients/${report.client.id}/logo?v=${encodeURIComponent(report.client.logoUrl)}`} alt={report.client.companyName} className="max-h-12 max-w-[180px] object-contain" />
            ) : <span />}
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title">{report.folio}</h1>
            <p className="meta">{report.client.companyName} · {report.project.projectName}</p>
          </div>
          <StatusBadge status={report.status} />
        </div>
        <dl className="grid gap-2 text-sm md:grid-cols-3">
          <div><dt className="text-muted-foreground">Periodo</dt><dd>{fmt(report.startDate)} – {fmt(report.endDate)}</dd></div>
          <div><dt className="text-muted-foreground">Consultores</dt><dd>{parseConsultants(report.consultants).join(", ")}</dd></div>
          <div><dt className="text-muted-foreground">Creado por</dt><dd>{report.createdBy.name}</dd></div>
        </dl>
        {report.status === "RECHAZADO" && report.rejectionComment && (
          <p className="rounded-xl bg-[#FF3B30]/10 p-4 text-sm text-[#D70015] dark:text-[#FF453A]">
            <strong>Motivo del rechazo:</strong> {report.rejectionComment}
          </p>
        )}
        {user.role !== "CLIENTE" && (
          <StatusControls reportId={report.id} status={report.status} isAdmin={isAdmin} />
        )}
        <ReportActions
          reportId={report.id}
          status={report.status}
          role={user.role}
          deletionPending={pending.some((p) => p.targetType === "REPORT")}
        />
      </div>

      <TaskList
        reportId={report.id}
        editable={editable}
        canDelete={user.role !== "CLIENTE" && (isAdmin || editable)}
        isAdmin={isAdmin}
        pendingTaskIds={pending.filter((p) => p.targetType === "TASK").map((p) => p.targetId)}
        initialTasks={report.tasks.map((t) => ({
          id: t.id,
          sequentialNum: t.sequentialNum,
          title: t.title,
          descriptionHtml: t.descriptionHtml,
          evidences: t.evidences.map((e) => ({ id: e.id, url: e.url, type: e.type })),
        }))}
      />

      {history.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-medium">Historial de cambios ({history.length})</summary>
          <ul className="mt-3 divide-y divide-black/5 text-sm dark:divide-white/10">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-4 py-2">
                <span>
                  <span className="font-medium">{actionLabel(h.action)}</span>
                  <span className="text-muted-foreground"> · {h.user.name}</span>
                  {detailReason(h.details) && (
                    <span className="block text-xs text-zinc-500">Motivo: {detailReason(h.details)}</span>
                  )}
                </span>
                <time className="shrink-0 text-muted-foreground">
                  {h.createdAt.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                </time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
