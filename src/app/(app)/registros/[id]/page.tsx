import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { findDuplicates } from "@/lib/registro";
import { suggestPrefix } from "@/lib/folio-prefix";
import { ReviewForm } from "./review-form";

export default async function RegistroReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["ADMIN", "EDITOR"]);
  const { id } = await params;
  const reg = await prisma.clientRegistration.findUnique({ where: { id }, include: { reviewedBy: { select: { name: true } } } });
  if (!reg) notFound();

  const duplicates = reg.status === "PENDIENTE" ? await findDuplicates({ companyName: reg.companyName, rfc: reg.rfc }, reg.id) : [];

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/registros" className="btn-outline inline-flex"><ArrowLeft size={16} /> Registros</Link>
      <h1 className="page-title">{reg.companyName}</h1>

      {reg.status !== "PENDIENTE" ? (
        <div className="card space-y-2">
          <p className="font-medium">
            Este registro fue {reg.status === "APROBADO" ? "aprobado" : "rechazado"}
            {reg.reviewedBy ? ` por ${reg.reviewedBy.name}` : ""}.
          </p>
          {reg.rejectionReason && <p className="meta">Motivo: {reg.rejectionReason}</p>}
          {reg.clientId && <Link href="/clientes" className="link">Ver en Clientes y proyectos</Link>}
        </div>
      ) : (
        <ReviewForm
          id={reg.id}
          suggestedPrefix={suggestPrefix(reg.companyName)}
          hasLogo={!!reg.logoUrl}
          constanciaHref={reg.constanciaUrl ? `/api/registros/${reg.id}/constancia` : null}
          duplicates={duplicates}
          defaults={{
            companyName: reg.companyName,
            requiresInvoice: reg.requiresInvoice,
            legalName: reg.legalName ?? "",
            rfc: reg.rfc ?? "",
            street: reg.street ?? "",
            colonia: reg.colonia ?? "",
            postalCode: reg.postalCode ?? "",
            city: reg.city ?? "",
            state: reg.state ?? "",
            contactName: reg.contactName,
            contactLastName: reg.contactLastName,
            contactPhone: reg.contactPhone,
            contactEmail: reg.contactEmail,
            billingName: reg.billingName,
            billingLastName: reg.billingLastName,
            billingPhone: reg.billingPhone,
            billingEmail: reg.billingEmail,
          }}
        />
      )}
    </div>
  );
}
