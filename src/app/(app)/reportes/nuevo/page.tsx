import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { NewReportForm } from "./new-report-form";

export default async function NewReportPage() {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const isTeam = user.role === "TEAM_311";

  const [allClients, team] = await Promise.all([
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true, projects: { select: { id: true, projectName: true } } },
    }),
    prisma.user.findMany({ where: { role: "TEAM_311", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true } }),
  ]);

  // El TEAM 311 solo ve los clientes y proyectos que le asignaron
  const mine = new Set(user.projectAccess.map((p) => p.projectId));
  const clients = isTeam
    ? allClients.map((c) => ({ ...c, projects: c.projects.filter((p) => mine.has(p.id)) })).filter((c) => c.projects.length > 0)
    : allClients;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">Nuevo reporte</h1>
      {clients.length === 0 ? (
        <p className="card meta">
          {isTeam
            ? "Todavía no tienes clientes ni proyectos asignados. Pídele al Administrador o al Editor que te los asignen."
            : "Primero crea un cliente con al menos un proyecto en «Clientes y proyectos»."}
        </p>
      ) : (
        <div className="card"><NewReportForm clients={clients} team={team} initialConsultants={isTeam ? [user.id] : []} /></div>
      )}
    </div>
  );
}
