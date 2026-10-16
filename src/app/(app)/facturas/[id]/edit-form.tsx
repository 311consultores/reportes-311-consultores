"use client";

import { useState } from "react";
import { updateInvoice } from "@/app/actions/invoices";
import { ActionForm } from "@/components/action-form";
import { DateInput } from "@/components/date-input";
import { formatCents, parseMoney, vatOf } from "@/lib/finance";

type Props = {
  id: string;
  kind: "FACTURA" | "RECIBO";
  defaults: { description: string; subtotal: string; dueDate: string; number: string; isSoftware: boolean };
};

/** Corrección de una factura mientras siga Enviada. */
export function EditInvoiceForm({ id, kind, defaults }: Props) {
  const [description, setDescription] = useState(defaults.description);
  const [subtotal, setSubtotal] = useState(defaults.subtotal);
  const cents = parseMoney(subtotal);
  const vat = cents !== null && kind === "FACTURA" ? vatOf(cents) : 0;

  return (
    <ActionForm action={updateInvoice} submitLabel="Guardar cambios" successMessage="Cambios guardados" resetOnSuccess={false} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label">Descripción</label>
        <input name="description" required maxLength={500} className="input uppercase" value={description} onChange={(e) => setDescription(e.target.value.toUpperCase())} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label">Subtotal (MXN)</label>
          <input name="subtotal" required inputMode="decimal" className="input" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
        </div>
        <div>
          <label className="label">{kind === "FACTURA" ? "Total (con 16 % de IVA)" : "Total"}</label>
          <input className="input font-semibold" readOnly tabIndex={-1} value={cents !== null ? formatCents(cents + vat) : ""} />
        </div>
        <div>
          <label className="label">Fecha límite de pago</label>
          <DateInput name="dueDate" required defaultValue={defaults.dueDate} />
        </div>
        <div>
          <label className="label">Número / folio fiscal</label>
          <input name="number" maxLength={60} className="input" defaultValue={defaults.number} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isSoftware" className="h-4 w-4" defaultChecked={defaults.isSoftware} /> Proyecto de <strong>SOFTWARE</strong>
      </label>
    </ActionForm>
  );
}
