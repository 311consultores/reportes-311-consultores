import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDocsConfig } from "@/lib/docs/config";
import { ConfigForm } from "./config-form";

export const metadata = { title: "Configuración de documentos | Portal de Operaciones" };

export default async function DocumentsConfigPage() {
  await requireUser(["ADMIN"]);
  const cfg = await getDocsConfig();
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/documentos" className="btn-outline inline-flex"><ArrowLeft size={16} /> Documentos</Link>
      <div>
        <h1 className="page-title">Configuración de documentos</h1>
        <p className="meta">Datos fijos que usan los recibos, acuerdos y contratos. Solo el ADMINISTRADOR los modifica.</p>
      </div>
      <ConfigForm cfg={cfg} />
    </div>
  );
}
