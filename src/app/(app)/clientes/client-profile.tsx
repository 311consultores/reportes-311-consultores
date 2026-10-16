"use client";

import { Mail, Phone } from "lucide-react";
import { updateClientProfile } from "@/app/actions/registros";
import { ActionForm } from "@/components/action-form";
import { ClientDataFields, type ClientFieldValues } from "@/components/client-data-fields";
import { CopyButton } from "@/components/copy-button";

type Props = { clientId: string; values: ClientFieldValues; hasConstancia: boolean; editOpen?: boolean };

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-0.5">
    <dt className="text-xs text-zinc-500">{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

function Contact({ title, name, phone, email }: { title: string; name: string; phone: string; email: string }) {
  if (!name && !phone && !email) {
    return (
      <div>
        <h4 className="mb-2 text-sm font-semibold">{title}</h4>
        <p className="text-sm text-zinc-500">Sin capturar</p>
      </div>
    );
  }
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <p className="text-sm">{name || "—"}</p>
      {phone && (
        <p className="flex flex-wrap items-center gap-1 text-sm">
          <Phone size={13} className="text-zinc-500" />
          <a className="link" href={`tel:${phone}`}>{phone}</a>
          <CopyButton text={phone} />
        </p>
      )}
      {email && (
        <p className="flex flex-wrap items-center gap-1 text-sm">
          <Mail size={13} className="text-zinc-500" />
          <a className="link" href={`mailto:${email}`}>{email}</a>
          <CopyButton text={email} />
        </p>
      )}
    </div>
  );
}

/** Datos fiscales y de contacto de un cliente: consulta con botones de copiar, y edición (Admin y Editor). */
export function ClientProfileBody({ clientId, values: v, hasConstancia, editOpen = false }: Props) {
  const address = [v.street, v.colonia, v.postalCode && `C.P. ${v.postalCode}`, v.city, v.state].filter(Boolean).join(", ");
  const empty = !v.contactName && !v.billingName && !v.rfc && !address;

  return (
    <div className="space-y-5">
      {empty && <p className="text-sm text-zinc-500">Aún no hay datos fiscales ni de contacto capturados.</p>}
      <dl className="grid gap-4 md:grid-cols-2">
        <Row label="Requiere factura">{v.requiresInvoice ? "Sí" : "No"}</Row>
        {v.requiresInvoice && (
          <>
            <Row label="Razón social">{v.legalName || "—"}</Row>
            <Row label="RFC">
              {v.rfc ? <span className="inline-flex items-center gap-1">{v.rfc}<CopyButton text={v.rfc} /></span> : "—"}
            </Row>
          </>
        )}
        <Row label="Dirección">{address || "—"}</Row>
        {v.requiresInvoice && (
          <Row label="Constancia de Situación Fiscal">
            {hasConstancia ? (
              <a className="link" href={`/api/clients/${clientId}/constancia`} target="_blank" rel="noreferrer">Ver PDF</a>
            ) : (
              "No cargada"
            )}
          </Row>
        )}
      </dl>
      <div className="grid gap-5 md:grid-cols-2">
        <Contact title="Contacto principal" name={v.contactName} phone={v.contactPhone} email={v.contactEmail} />
        <Contact title="Administración y facturación" name={v.billingName} phone={v.billingPhone} email={v.billingEmail} />
      </div>

      <details open={editOpen}>
        <summary className="link cursor-pointer text-sm">Editar datos</summary>
        <ActionForm
          action={updateClientProfile}
          submitLabel="Guardar datos"
          className="mt-4 space-y-5"
          resetOnSuccess={false}
          successMessage="Datos guardados"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <ClientDataFields defaults={v} showConstancia constanciaHref={hasConstancia ? `/api/clients/${clientId}/constancia` : null} />
        </ActionForm>
      </details>
    </div>
  );
}
