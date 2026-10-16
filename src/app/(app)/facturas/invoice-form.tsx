"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createInvoice } from "@/app/actions/invoices";
import { ActionForm } from "@/components/action-form";
import { DateInput } from "@/components/date-input";
import { SearchSelect } from "@/components/search-select";
import { formatCents, parseMoney, vatOf } from "@/lib/finance";
import { cn } from "@/lib/utils";

type ClientOpt = { id: string; companyName: string; rfc: string | null };

/** Registro de una factura o recibo que ya se envió al cliente. */
export function InvoiceForm({ clients }: { clients: ClientOpt[] }) {
  const [kind, setKind] = useState<"FACTURA" | "RECIBO">("FACTURA");
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [subtotal, setSubtotal] = useState("");

  const options = useMemo(() => clients.map((c) => ({ value: c.id, label: c.companyName })), [clients]);
  const client = clients.find((c) => c.id === clientId);
  const cents = parseMoney(subtotal);
  const vat = cents !== null && kind === "FACTURA" ? vatOf(cents) : 0;
  const missingRfc = kind === "FACTURA" && !!client && !client.rfc;

  const seg = (active: boolean) =>
    cn(
      "cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out",
      active ? "bg-[#007AFF] text-white shadow-sm" : "glass text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10",
    );

  return (
    <ActionForm
      action={createInvoice}
      submitLabel="Registrar"
      successMessage="Registrado correctamente"
      className="space-y-4"
      onSuccess={() => {
        setClientId("");
        setDescription("");
        setSubtotal("");
      }}
    >
      <div className="flex flex-wrap gap-2">
        <label className={seg(kind === "FACTURA")}>
          <input type="radio" name="kind" value="FACTURA" className="sr-only" checked={kind === "FACTURA"} onChange={() => setKind("FACTURA")} />
          Factura (con IVA)
        </label>
        <label className={seg(kind === "RECIBO")}>
          <input type="radio" name="kind" value="RECIBO" className="sr-only" checked={kind === "RECIBO"} onChange={() => setKind("RECIBO")} />
          Recibo simple (sin IVA)
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label">Cliente</label>
          <SearchSelect name="clientId" required options={options} value={clientId} onChange={setClientId} placeholder="Escribe para buscar un cliente…" />
        </div>
        <div>
          <label className="label">RFC</label>
          <input className="input" readOnly tabIndex={-1} value={kind === "RECIBO" ? "No aplica" : client ? (client.rfc ?? "Sin RFC") : ""} placeholder="Se completa solo" />
        </div>
      </div>
      {missingRfc && (
        <p className="rounded-xl bg-[#FF9500]/15 p-3 text-sm text-[#C93400] dark:text-[#FF9F0A]">
          «{client?.companyName}» no tiene RFC capturado. Captúralo en{" "}
          <Link href="/clientes" className="link font-medium">Clientes y proyectos › Datos fiscales y de contacto</Link> antes de registrar la factura.
        </p>
      )}

      <div>
        <label className="label">Descripción</label>
        <input
          name="description"
          required
          maxLength={500}
          className="input uppercase"
          value={description}
          onChange={(e) => setDescription(e.target.value.toUpperCase())}
          placeholder="SERVICIOS DE CONSULTORÍA — OCTUBRE 2026"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label">Subtotal (MXN)</label>
          <input name="subtotal" required inputMode="decimal" className="input" placeholder="0.00" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
        </div>
        <div>
          <label className="label">{kind === "FACTURA" ? "Total (subtotal + 16 % de IVA)" : "Total"}</label>
          <input className="input font-semibold" readOnly tabIndex={-1} value={cents !== null ? formatCents(cents + vat) : ""} placeholder="Se calcula solo" />
          {kind === "FACTURA" && cents !== null && <p className="mt-1 text-xs text-zinc-500">IVA: {formatCents(vat)}</p>}
        </div>
        <div>
          <label className="label">Fecha límite de pago</label>
          <DateInput name="dueDate" required />
        </div>
        <div>
          <label className="label">Número / folio fiscal (opcional)</label>
          <input name="number" maxLength={60} className="input" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isSoftware" className="h-4 w-4" /> Proyecto de <strong>SOFTWARE</strong>
      </label>
    </ActionForm>
  );
}
