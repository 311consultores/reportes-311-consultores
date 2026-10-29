import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/finance";
import { mailConfigured, mailDryRun } from "@/lib/mailer";
import { getDocsConfig } from "@/lib/docs/config";
import { defaultEmail } from "@/lib/docs/templates";
import { parseEmails } from "@/lib/docs/text";
import { KIND_LABEL } from "@/lib/docs/types";
import { cn } from "@/lib/utils";
import { DocActions } from "../doc-actions";
import { SendPanel } from "../send-panel";

export const metadata = { title: "Documento | Portal de Operaciones" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { client: true, createdBy: { select: { name: true } }, sends: { orderBy: { sentAt: "desc" }, include: { sentBy: { select: { name: true } } } } },
  });
  if (!doc) notFound();
  const cfg = await getDocsConfig();
  const draft = doc.status === "BORRADOR";
  const mail = defaultEmail(doc.kind, { cliente: doc.client.companyName, folio: doc.folio });
  const to = parseEmails([doc.client.mainEmails, doc.client.contactEmail ?? ""].join(",")).join(", ");
  const title = `${KIND_LABEL[doc.kind]}${doc.folio ? ` · ${doc.folio}` : ""}`;
  const v = doc.updatedAt.getTime();

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/documentos" className="btn-outline inline-flex"><ArrowLeft size={16} /> Documentos</Link>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title">{title}</h1>
            <p className="meta">{doc.client.companyName} · creó {doc.createdBy.name} · {fmtDateTime(doc.createdAt)}</p>
            <p className="mt-1 break-all text-xs text-zinc-500"><FileText size={12} className="mr-1 inline" />{doc.fileName}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-medium", draft ? "bg-[#FF9500]/15 text-[#B25E00] dark:text-[#FFB340]" : "bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158]")}>
            {draft ? "Borrador" : `Enviado ${doc.sentAt ? fmtDateTime(doc.sentAt) : ""}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {draft && <Link href={`/documentos/${doc.id}/editar`} className="btn-outline"><Pencil size={15} /> Editar datos</Link>}
          <a href={`/api/documentos/${doc.id}/pdf?descargar=1`} className="btn-outline"><Download size={15} /> Descargar PDF</a>
          <a href={`/api/documentos/${doc.id}/docx`} className="btn-outline"><Download size={15} /> Descargar Word</a>
          <a href={`/api/documentos/${doc.id}/pdf?v=${v}`} target="_blank" rel="noreferrer" className="btn-outline"><ExternalLink size={15} /> Abrir en otra pestaña</a>
          <DocActions id={doc.id} draft={draft} canDelete={me.role === "ADMIN"} />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Vista previa</h2>
        <p className="meta">Lee el documento completo antes de enviarlo. Si algo no está bien, usa «Editar datos» y vuelve aquí.</p>
        <iframe src={`/api/documentos/${doc.id}/pdf?v=${v}`} title="Vista previa del documento" className="h-[85vh] w-full rounded-2xl border border-black/10 bg-white dark:border-white/15" />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">{draft ? "Enviar por correo" : "Reenviar por correo"}</h2>
        <SendPanel id={doc.id} defaults={{ to, subject: mail.subject, body: mail.body }} bcc={cfg.bcc} resend={!draft} mailReady={mailConfigured() || mailDryRun()} />
      </section>

      {doc.sends.length > 0 && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Envíos realizados</h2>
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
            {doc.sends.map((s) => (
              <li key={s.id} className="py-2">
                <span className="font-medium">{fmtDateTime(s.sentAt)}</span> · {s.sentBy.name}
                <span className="block text-xs text-zinc-500">Para: {s.toEmails}{s.bccEmails ? ` · CCO: ${s.bccEmails}` : ""} · Asunto: {s.subject}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
