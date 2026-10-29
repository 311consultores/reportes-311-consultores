import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { todayMx } from "@/lib/finance";
import { getClientOpts } from "@/lib/docs/client-opts";
import { empresaOf, getDocsConfig, missingEmpresa } from "@/lib/docs/config";
import { SERVICIOS_BASE } from "@/lib/docs/templates";
import { AcuerdoForm } from "../../acuerdo-form";
import { ContratoForm } from "../../contrato-form";
import { ReciboForm } from "../../recibo-form";

export const metadata = { title: "Nuevo documento | Portal de Operaciones" };

export default async function NewDocumentPage({ params }: { params: Promise<{ kind: string }> }) {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const { kind } = await params;
  if (kind !== "recibo" && kind !== "acuerdo" && kind !== "contrato") notFound();
  const [clients, cfg] = await Promise.all([getClientOpts(), getDocsConfig()]);
  const falta = kind !== "recibo" ? missingEmpresa(empresaOf(cfg)) : [];

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/documentos" className="btn-outline inline-flex"><ArrowLeft size={16} /> Documentos</Link>
      <div>
        <h1 className="page-title">{kind === "recibo" ? "Nuevo recibo de pago" : kind === "contrato" ? "Nuevo contrato de prestación de servicios" : "Nuevo acuerdo de confidencialidad"}</h1>
        <p className="meta">Captura solo los datos que cambian. Al guardar verás el documento completo para revisarlo antes de enviarlo.</p>
      </div>
      {falta.length > 0 ? (
        <div className="card text-sm">
          <strong>Faltan datos de la empresa:</strong> {falta.join(", ")}.{" "}
          {me.role === "ADMIN" ? <Link href="/documentos/configuracion" className="link">Completarlos en Configuración</Link> : "Pídele al Administrador que los complete en Documentos › Configuración."}
        </div>
      ) : kind === "recibo" ? (
        <ReciboForm clients={clients} recibe={cfg.recibe.map((p) => ({ nombre: p.nombre, hasFirma: !!p.firmaKey }))} today={todayMx()} />
      ) : kind === "contrato" ? (
        <ContratoForm clients={clients} cargos={cfg.cargos} catalog={SERVICIOS_BASE} today={todayMx()} defaultEmail={cfg.emailRescision} />
      ) : (
        <AcuerdoForm clients={clients} cargos={cfg.cargos} today={todayMx()} />
      )}
    </div>
  );
}
