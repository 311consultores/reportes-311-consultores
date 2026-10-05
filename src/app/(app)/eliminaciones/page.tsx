import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { resolveDeletion } from "@/app/actions/deletions";

export default async function DeletionsPage() {
  await requireUser(["ADMIN"]);
  const requests = await prisma.deletionRequest.findMany({
    where: { status: "PENDIENTE" },
    include: { requestedBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const items = await Promise.all(
    requests.map(async (r) => {
      let label = "(ya no existe)";
      if (r.targetType === "REPORT") {
        const rep = await prisma.report.findUnique({ where: { id: r.targetId }, select: { folio: true } });
        if (rep) label = `Reporte ${rep.folio}`;
      } else if (r.targetType === "TASK") {
        const t = await prisma.reportTask.findUnique({
          where: { id: r.targetId },
          select: { sequentialNum: true, report: { select: { folio: true } } },
        });
        if (t) label = `Actividad ${t.sequentialNum} del reporte ${t.report.folio}`;
      }
      return { ...r, label };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="page-title">Solicitudes de eliminación</h1>
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">{r.label}</p>
              <p className="meta">
                Solicitado por {r.requestedBy.name} · {r.createdAt.toLocaleDateString("es-MX")}
              </p>
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
        {items.length === 0 && <p className="card meta">No hay solicitudes pendientes.</p>}
      </div>
    </div>
  );
}
