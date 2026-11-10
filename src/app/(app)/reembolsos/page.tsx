import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { decimalToCents, isoDate, todayMx } from "@/lib/finance";
import { getBalances } from "@/lib/ledger";
import { ReimbursementForm } from "./reimbursement-form";
import { ReimbursementList, type ReimbRow } from "./reimbursement-list";

export const metadata = { title: "Reembolsos | Portal de Operaciones" };

export default async function ReimbursementsPage({ searchParams }: { searchParams: Promise<{ reembolso?: string }> }) {
  const user = await requireUser(["ADMIN", "TEAM_311"]);
  const isAdmin = user.role === "ADMIN";
  const { reembolso } = await searchParams;

  const rows = await prisma.reimbursement.findMany({
    where: isAdmin ? {} : { requestedById: user.id },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { requestedBy: { select: { name: true } } },
  });
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((x): x is string => !!x))];
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((x): x is string => !!x))];
  const [clients, projects, allClients] = await Promise.all([
    prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, companyName: true } }),
    prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, projectName: true } }),
    isAdmin ? Promise.resolve([]) : prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true, projects: { orderBy: { projectName: "asc" }, select: { id: true, projectName: true } } } }),
  ]);
  const cName = new Map(clients.map((c) => [c.id, c.companyName]));
  const pName = new Map(projects.map((p) => [p.id, p.projectName]));

  const list: ReimbRow[] = rows.map((r) => ({
    id: r.id, who: r.requestedBy.name, concept: r.concept, cents: decimalToCents(r.amount), spentOn: isoDate(r.spentOn), urgency: r.urgency,
    client: r.clientId ? cName.get(r.clientId) ?? null : null, project: r.projectId ? pName.get(r.projectId) ?? null : null,
    status: r.status as ReimbRow["status"], rejectReason: r.rejectReason, receiptName: r.receiptName, receiptType: r.receiptType,
    createdAt: r.createdAt.toISOString(), paidAt: r.paidAt?.toISOString() ?? null,
  }));

  const balances = isAdmin ? Object.fromEntries(await getBalances()) : {};

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Reembolsos</h1>
        <p className="meta">{isAdmin ? "Dinero que el equipo puso de su bolsillo para la empresa. Aprueba o rechaza y, al pagar, elige la caja y cómo se divide." : "Si pagaste algo de tu bolsillo para la empresa, regístralo aquí con su comprobante para que te lo devuelvan."}</p>
      </div>
      {!isAdmin && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Solicitar reembolso</h2>
          <ReimbursementForm today={todayMx()} clients={allClients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }))} />
        </section>
      )}
      <ReimbursementList rows={list} isAdmin={isAdmin} balances={balances} openId={reembolso} />
    </div>
  );
}
