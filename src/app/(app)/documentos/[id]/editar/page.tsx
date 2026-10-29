import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { todayMx } from "@/lib/finance";
import { getClientOpts } from "@/lib/docs/client-opts";
import { getDocsConfig } from "@/lib/docs/config";
import { parseDocData } from "@/lib/docs/types";
import { AcuerdoForm } from "../../acuerdo-form";
import { ReciboForm } from "../../recibo-form";

export const metadata = { title: "Editar documento | Portal de Operaciones" };

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["ADMIN", "EDITOR"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) notFound();
  if (doc.status !== "BORRADOR") redirect(`/documentos/${id}`); // un documento enviado ya no se edita (se duplica)
  const [clients, cfg] = await Promise.all([getClientOpts(), getDocsConfig()]);
  const d = parseDocData(doc.data);

  return (
    <div className="max-w-4xl space-y-6">
      <Link href={`/documentos/${id}`} className="btn-outline inline-flex"><ArrowLeft size={16} /> Volver a la vista previa</Link>
      <h1 className="page-title">Editar {d.kind === "RECIBO" ? `recibo ${doc.folio ?? ""}` : "acuerdo de confidencialidad"}</h1>
      {d.kind === "RECIBO" ? (
        <ReciboForm
          docId={id} clients={clients} today={todayMx()} recibe={cfg.recibe.map((p) => ({ nombre: p.nombre, hasFirma: !!p.firmaKey }))}
          initial={{
            clientId: doc.clientId, clienteNombre: d.clienteNombre, clienteEmpresa: d.clienteEmpresa, fecha: d.fecha, recibe: d.recibe, incluirFirma: !!d.firmaKey, folio: doc.folio ?? undefined,
            rows: d.conceptos.map((c) => ({ desc: c.desc, monto: (c.cents / 100).toFixed(2) })),
          }}
        />
      ) : d.kind === "ACUERDO" ? (
        <AcuerdoForm
          docId={id} clients={clients} cargos={cfg.cargos.includes(d.cargoEmpresa) ? cfg.cargos : [d.cargoEmpresa, ...cfg.cargos]} today={todayMx()}
          initial={{
            clientId: doc.clientId, razon: d.cliente.razon, clienteDomicilio: d.cliente.domicilio, repNombre: d.rep.nombre, repDomicilio: d.rep.domicilio, repCurp: d.rep.curp, repIne: d.rep.ine, repRol: d.rep.rol,
            fecha: d.fecha, cargo: d.cargoEmpresa, meses: d.meses, anios: d.anios, pena: (d.penaCents / 100).toFixed(2), extraTitulo: d.extra?.titulo ?? "", extraTexto: d.extra?.texto ?? "",
          }}
        />
      ) : (
        <p className="meta">Este tipo de documento todavía no se puede editar.</p>
      )}
    </div>
  );
}
