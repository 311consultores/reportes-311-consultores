import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { resolveDeletion } from "@/app/actions/deletions";

const TYPE_LABEL: Record<string, string> = { TASK: "Actividad", REPORT: "Reporte", CLIENT: "Cliente", PROJECT: "Proyecto" };
const when = (d: Date) => d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });

export default async function DeletionsPage() {
  await requireUser(["ADMIN"]);
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
      <h1 className="page-title">Eliminaciones</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Solicitudes pendientes</h2>
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

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Historial</h2>
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
                    {(r.targetType === "CLIENT" || r.targetType === "PROJECT") && (
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
