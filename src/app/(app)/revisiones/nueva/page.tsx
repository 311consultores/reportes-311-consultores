import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { REVIEW_CREATORS } from "@/lib/reviews";
import { NewReviewForm } from "./new-review-form";

export const metadata = { title: "Nueva revisión | Portal de Operaciones" };

export default async function NewReviewPage() {
  await requireUser(REVIEW_CREATORS);
  const [clients, team] = await Promise.all([
    prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true, mainEmails: true, projects: { orderBy: { projectName: "asc" }, select: { id: true, projectName: true, projectEmails: true } } } }),
    prisma.user.findMany({ where: { role: "TEAM_311", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/revisiones" className="btn-outline inline-flex"><ArrowLeft size={16} /> Revisiones</Link>
      <div>
        <h1 className="page-title">Nueva revisión</h1>
        <p className="meta">Primero se capturan los datos generales. En el siguiente paso se agregan los slides (copy y arte) y se publica al cliente.</p>
      </div>
      {clients.length === 0 ? <p className="card meta">Primero crea un cliente con al menos un proyecto en «Clientes y proyectos».</p> : (
        <div className="card"><NewReviewForm clients={clients} team={team} /></div>
      )}
    </div>
  );
}
