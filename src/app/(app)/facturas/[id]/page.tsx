import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  accountLabel, centsToDecimal, decimalToCents, displayStatus, fmtDate, fmtDateTime, formatDecimal, isoDate, KIND_LABEL, todayMx,
} from "@/lib/finance";
import { EditInvoiceForm } from "./edit-form";
import { RevertButton } from "./revert-button";
import { DeleteInvoice } from "./delete-invoice";
import { PayButton } from "../pay-button";
import { StatusPill } from "../status-pill";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><dt className="text-muted-foreground">{label}</dt><dd>{children}</dd></div>
);

function describe(action: string, details: string | null): string {
  let d: Record<string, unknown> = {};
  try {
    d = details ? JSON.parse(details) : {};
  } catch {
    /* sin detalles legibles */
  }
  if (action === "CREATED") return "Registró el documento";
  if (action === "PAID") return `Marcó como pagada · ${accountLabel(d.account as never)} · cobro del ${d.collectedOn}`;
  if (action === "REVERTED") return `Revirtió el pago${d.reason ? ` · Motivo: ${d.reason}` : ""}`;
  if (action === "EDITED") {
    const b = (d.before ?? {}) as Record<string, unknown>;
    const a = (d.after ?? {}) as Record<string, unknown>;
    const names: Record<string, string> = { description: "descripción", number: "número", subtotal: "subtotal", isSoftware: "software", dueDate: "fecha límite" };
    const changed = Object.keys(names).filter((k) => String(b[k] ?? "") !== String(a[k] ?? ""));
    return `Corrigió: ${changed.length ? changed.map((k) => names[k]).join(", ") : "sin cambios de datos"}`;
  }
  return action;
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: { select: { companyName: true } },
      createdBy: { select: { name: true } },
      paidBy: { select: { name: true } },
      logs: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!inv) notFound();

  const today = todayMx();
  const st = displayStatus(inv, today);
  const pending = await prisma.deletionRequest.findFirst({ where: { targetType: "INVOICE", targetId: inv.id, status: "PENDIENTE" }, select: { id: true } });

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/facturas" className="btn-outline inline-flex"><ArrowLeft size={16} /> Facturas</Link>

      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title">{KIND_LABEL[inv.kind]}{inv.number ? ` ${inv.number}` : ""}</h1>
            <p className="meta">{inv.client.companyName}{inv.rfc ? ` · ${inv.rfc}` : ""}</p>
          </div>
          {st === "PAGADA" ? <StatusPill status={st} /> : <PayButton id={inv.id} kind={inv.kind} status={st} today={today} label={`${KIND_LABEL[inv.kind]} de ${inv.client.companyName}`} />}
        </div>
        <p className="text-sm">{inv.description}</p>
        <dl className="grid gap-3 text-sm md:grid-cols-4">
          <Row label="Subtotal">{formatDecimal(inv.subtotal)}</Row>
          <Row label={inv.kind === "FACTURA" ? "IVA 16 %" : "IVA"}>{inv.kind === "FACTURA" ? formatDecimal(inv.vat) : "No aplica"}</Row>
          <Row label="Total"><strong>{formatDecimal(inv.total)}</strong></Row>
          <Row label="Fecha límite de pago">{fmtDate(inv.dueDate)}</Row>
          <Row label="Registrada">{fmtDateTime(inv.sentAt)} · {inv.createdBy.name}</Row>
          <Row label="Software">{inv.isSoftware ? "Sí" : "No"}</Row>
          {inv.status === "PAGADA" && (
            <>
              <Row label="Cobrada el">{inv.collectedOn ? fmtDate(inv.collectedOn) : "—"}</Row>
              <Row label="Cuenta receptora">{accountLabel(inv.account)}</Row>
              <Row label="Marcada como pagada">{inv.paidAt ? fmtDateTime(inv.paidAt) : "—"}{inv.paidBy ? ` · ${inv.paidBy.name}` : ""}</Row>
            </>
          )}
        </dl>
        <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-4 dark:border-white/10">
          {inv.status === "PAGADA" && isAdmin && <RevertButton id={inv.id} />}
          {inv.status === "PAGADA" && !isAdmin && <span className="meta">Un pago registrado solo lo puede revertir el Administrador.</span>}
          {inv.status === "ENVIADA" && <DeleteInvoice id={inv.id} isAdmin={isAdmin} alreadyPending={!!pending} />}
        </div>
      </div>

      {inv.status === "ENVIADA" && (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Corregir datos</h2>
          <EditInvoiceForm
            id={inv.id}
            kind={inv.kind}
            defaults={{
              description: inv.description,
              subtotal: centsToDecimal(decimalToCents(inv.subtotal)),
              dueDate: isoDate(inv.dueDate),
              number: inv.number ?? "",
              isSoftware: inv.isSoftware,
            }}
          />
        </section>
      )}

      <details className="card" open>
        <summary className="cursor-pointer font-medium">Historial ({inv.logs.length})</summary>
        <ul className="mt-3 divide-y divide-black/5 text-sm dark:divide-white/10">
          {inv.logs.map((l) => (
            <li key={l.id} className="flex justify-between gap-4 py-2">
              <span>
                <span className="font-medium">{describe(l.action, l.details)}</span>
                <span className="text-muted-foreground"> · {l.user.name}</span>
              </span>
              <time className="shrink-0 text-muted-foreground">{fmtDateTime(l.createdAt)}</time>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
