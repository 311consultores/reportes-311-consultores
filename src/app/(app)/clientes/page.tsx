import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fullName } from "@/lib/client-data";
import { ClientsGrid } from "./clients-grid";
import type { CardClient } from "./client-card";

export default async function ClientsPage() {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const isAdmin = user.role === "ADMIN"; // solo el Admin elimina clientes y proyectos
  const clients = await prisma.client.findMany({
    include: { projects: { orderBy: { createdAt: "asc" } }, _count: { select: { reports: true } } },
    orderBy: { companyName: "asc" },
  });

  const cards: CardClient[] = clients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    folioPrefix: c.folioPrefix,
    mainEmails: c.mainEmails,
    logoUrl: c.logoUrl,
    reportCount: c._count.reports,
    createdAt: c.createdAt.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
    projects: c.projects.map((p) => ({ id: p.id, projectName: p.projectName, projectEmails: p.projectEmails, responsible: fullName(p.responsibleName, p.responsibleLastName) })),
    hasConstancia: !!c.constanciaUrl,
    values: {
      companyName: c.companyName,
      requiresInvoice: c.requiresInvoice,
      legalName: c.legalName ?? "",
      rfc: c.rfc ?? "",
      street: c.street ?? "",
      colonia: c.colonia ?? "",
      postalCode: c.postalCode ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      contactName: c.contactName ?? "",
      contactLastName: c.contactLastName ?? "",
      contactPhone: c.contactPhone ?? "",
      contactEmail: c.contactEmail ?? "",
      billingName: c.billingName ?? "",
      billingLastName: c.billingLastName ?? "",
      billingPhone: c.billingPhone ?? "",
      billingEmail: c.billingEmail ?? "",
    },
  }));

  return (
    <div className="space-y-6">
      <h1 className="page-title">Clientes y proyectos</h1>

      <ClientsGrid clients={cards} isAdmin={isAdmin} />
    </div>
  );
}
