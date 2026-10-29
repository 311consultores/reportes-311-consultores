import Link from "next/link";
import { FilePlus2, Settings } from "lucide-react";
import type { DocKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/finance";
import { empresaOf, getDocsConfig, missingEmpresa } from "@/lib/docs/config";
import { KIND_LABEL } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Documentos | Portal de Operaciones" };

const KINDS: DocKind[] = ["RECIBO", "ACUERDO", "CONTRATO"];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const sp = await searchParams;
  const tipo = KINDS.find((k) => k === sp.tipo);
  const cliente = typeof sp.cliente === "string" && /^[0-9a-f-]{36}$/i.test(sp.cliente) ? sp.cliente : "";
  const where: Prisma.DocumentWhereInput = { ...(tipo ? { kind: tipo } : {}), ...(cliente ? { clientId: cliente } : {}) };

  const [docs, clients, cfg] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 300, include: { client: { select: { companyName: true } }, createdBy: { select: { name: true } } } }),
    prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    getDocsConfig(),
  ]);
  const falta = missingEmpresa(empresaOf(cfg));
  const isAdmin = me.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Documentos</h1>
          <p className="meta">Recibos de pago, acuerdos de confidencialidad y contratos: captura los datos, revisa la vista previa y envíalos por correo.</p>
        </div>
        {isAdmin && <Link href="/documentos/configuracion" className="btn-outline"><Settings size={16} /> Configuración</Link>}
      </div>

      {falta.length > 0 && (
        <div className="card text-sm" role="status">
          <p><strong>Faltan datos de la empresa</strong> para hacer acuerdos y contratos: {falta.join(", ")}.{" "}
            {isAdmin ? <Link href="/documentos/configuracion" className="link">Completarlos en Configuración</Link> : "Pídele al Administrador que los complete en Documentos › Configuración."}</p>
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Nuevo documento</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/documentos/nuevo/recibo" className="btn"><FilePlus2 size={16} /> Recibo de pago</Link>
          <Link href="/documentos/nuevo/acuerdo" className="btn"><FilePlus2 size={16} /> Acuerdo de confidencialidad</Link>
          <span className="btn-outline cursor-not-allowed opacity-60" title="Disponible en la siguiente etapa"><FilePlus2 size={16} /> Contrato (próximamente)</span>
        </div>
      </section>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" className="input" defaultValue={tipo ?? ""}>
            <option value="">Todos</option>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cliente">Cliente</label>
          <select id="cliente" name="cliente" className="input" defaultValue={cliente}>
            <option value="">Todos</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <button className="btn" type="submit">Filtrar</button>
        {(tipo || cliente) && <Link href="/documentos" className="btn-outline">Quitar filtros</Link>}
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr><th className="th">Documento</th><th className="th">Cliente</th><th className="th">Creó</th><th className="th">Fecha</th><th className="th">Estado</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="td">
                  <Link href={`/documentos/${d.id}`} className="font-medium">{KIND_LABEL[d.kind]}{d.folio ? ` · ${d.folio}` : ""}</Link>
                  <span className="block max-w-[28rem] truncate text-xs text-zinc-500">{d.fileName}</span>
                </td>
                <td className="td">{d.client.companyName}</td>
                <td className="td">{d.createdBy.name}</td>
                <td className="td whitespace-nowrap">{fmtDateTime(d.sentAt ?? d.createdAt)}</td>
                <td className="td">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", d.status === "ENVIADO" ? "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]" : "bg-[#FF9500]/15 text-[#B25E00] dark:text-[#FFB340]")}>
                    {d.status === "ENVIADO" ? "Enviado" : "Borrador"}
                  </span>
                </td>
                <td className="td text-right"><Link href={`/documentos/${d.id}`} className="link text-xs">Abrir</Link></td>
              </tr>
            ))}
            {docs.length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-zinc-500">Todavía no hay documentos{tipo || cliente ? " con esos filtros" : ""}. Crea el primero con los botones de arriba.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
