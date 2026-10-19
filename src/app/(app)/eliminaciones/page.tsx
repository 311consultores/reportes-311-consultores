import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { resolveDeletion } from "@/app/actions/deletions";
import { EditRequestActions } from "./edit-request-actions";

const TYPE_LABEL: Record<string, string> = { TASK: "Actividad", REPORT: "Reporte", CLIENT: "Cliente", PROJECT: "Proyecto", INVOICE: "Factura / recibo", USER: "Usuario", WORKTASK: "Tarea" };
const when = (d: Date) => d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });

export default async function DeletionsPage() {
  await requireUser(["ADMIN"]);
  const [editPending, editHistory] = await Promise.all([
    prisma.editRequest.findMany({
      where: { status: "PENDIENTE" },
      include: { requestedBy: { select: { name: true } }, report: { select: { folio: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.editRequest.findMany({
      where: { status: { not: "PENDIENTE" } },
      include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } }, report: { select: { folio: true } } },
      orderBy: { resolvedAt: "desc" },
      take: 30,
    }),
  ]);
  const merges = await prisma.auditLog.findMany({
    where: { action: "MERGED_CLIENTS" },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const [pending, history] = await Promise.all([
    prisma.deletionRequest.findMany({
      where: { status: "PENDIENTE" },
      include: { requestedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deletionRequest.findMany({
      where: { status: { not: "PENDIENTE" } },
      include: { requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } },
      orderBy: { resolvedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="page-title">Log</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Solicitudes de edición pendientes</h2>
        {editPending.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                <Link href={`/reportes/${r.reportId}`} className="link">{r.report.folio}</Link> · edición solicitada por {r.requestedBy.name}
              </p>
              <p className="meta">{when(r.createdAt)}</p>
              <p className="mt-1 text-sm">Motivo: {r.reason}</p>
            </div>
            <EditRequestActions id={r.id} />
          </div>
        ))}
        {editPending.length === 0 && <p className="card meta">No hay solicitudes de edición pendientes.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Solicitudes de eliminación pendientes</h2>
        {pending.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">{r.targetLabel ?? `${TYPE_LABEL[r.targetType] ?? r.targetType} (ya no existe)`}</p>
              <p className="meta">Solicitado por {r.requestedBy.name} · {when(r.createdAt)}</p>
              {r.reason && <p className="mt-1 text-sm">Motivo: {r.reason}</p>}
            </div>
            <div className="flex gap-2">
              <form action={resolveDeletion.bind(null, r.id, true)}>
                <button className="btn-danger">Aprobar y eliminar</button>
              </form>
              <form action={resolveDeletion.bind(null, r.id, false)}>
                <button className="btn-outline">Rechazar</button>
              </form>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="card meta">No hay solicitudes pendientes.</p>}
      </section>

      {editHistory.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Solicitudes de edición resueltas</h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead className="border-b border-black/5 dark:border-white/10">
                <tr><th className="th">Fecha</th><th className="th">Reporte</th><th className="th">Motivo</th><th className="th">Solicitó</th><th className="th">Resolvió</th><th className="th">Resultado</th></tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {editHistory.map((r) => (
                  <tr key={r.id}>
                    <td className="td whitespace-nowrap">{r.resolvedAt ? when(r.resolvedAt) : "—"}</td>
                    <td className="td"><Link href={`/reportes/${r.reportId}`} className="link">{r.report.folio}</Link></td>
                    <td className="td">{r.reason}</td>
                    <td className="td">{r.requestedBy.name}</td>
                    <td className="td">{r.reviewedBy?.name ?? "—"}</td>
                    <td className="td">{r.status === "APROBADO" ? "Aprobada" : "Rechazada"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {merges.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Fusiones de clientes</h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead className="border-b border-black/5 dark:border-white/10">
                <tr><th className="th">Fecha</th><th className="th">Se conservó</th><th className="th">Se fusionó (desapareció)</th><th className="th">Pasaron</th><th className="th">Lo hizo</th></tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {merges.map((m) => {
                  let d: { kept?: { name: string; prefix: string }; removed?: { name: string; prefix: string }; moved?: { projects: number; reports: number; invoices: number } } = {};
                  try { d = JSON.parse(m.details ?? "{}"); } catch { /* sin detalle */ }
                  return (
                    <tr key={m.id}>
                      <td className="td whitespace-nowrap">{when(m.createdAt)}</td>
                      <td className="td">{d.kept ? `${d.kept.name} (${d.kept.prefix})` : "—"}</td>
                      <td className="td">{d.removed ? `${d.removed.name} (${d.removed.prefix})` : "—"}</td>
                      <td className="td">{d.moved ? `${d.moved.projects} proyecto(s), ${d.moved.reports} reporte(s), ${d.moved.invoices} factura(s)` : "—"}</td>
                      <td className="td">{m.user.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Historial de eliminaciones</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10">
              <tr>
                <th className="th">Fecha</th><th className="th">Elemento</th><th className="th">Motivo</th>
                <th className="th">Solicitó</th><th className="th">Resolvió</th><th className="th">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap">{r.resolvedAt ? when(r.resolvedAt) : "—"}</td>
                  <td className="td">
                    {/* En actividades y reportes la etiqueta ya empieza con el tipo; en cliente/proyecto se antepone */}
                    {(r.targetType === "CLIENT" || r.targetType === "PROJECT" || r.targetType === "USER") && (
                      <>
                        <span className="meta">{TYPE_LABEL[r.targetType]}</span>
                        <br />
                      </>
                    )}
                    {r.targetLabel ?? "—"}
                  </td>
                  <td className="td">{r.reason ?? "—"}</td>
                  <td className="td">{r.requestedBy.name}</td>
                  <td className="td">{r.reviewedBy?.name ?? "—"}</td>
                  <td className="td">
                    <span
                      className={
                        r.status === "APROBADO"
                          ? "rounded-full bg-[#FF3B30]/10 px-3 py-1 text-xs font-medium text-[#D70015] dark:text-[#FF453A]"
                          : "rounded-full bg-zinc-500/10 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                      }
                    >
                      {r.status === "APROBADO" ? "Eliminado" : "Rechazada"}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={6} className="td py-8 text-center text-zinc-500">Aún no hay eliminaciones registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
