import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { NewReportForm } from "./new-report-form";

export default async function NewReportPage() {
  await requireUser(["ADMIN", "EDITOR"]);
  const clients = await prisma.client.findMany({
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true, projects: { select: { id: true, projectName: true } } },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">Nuevo reporte</h1>
      {clients.length === 0 ? (
        <p className="card meta">
          Primero crea un cliente con al menos un proyecto en «Clientes y proyectos».
        </p>
      ) : (
        <div className="card"><NewReportForm clients={clients} /></div>
      )}
    </div>
  );
}
