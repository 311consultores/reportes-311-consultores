"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { saveRecibo } from "@/app/actions/documents";
import { ActionForm } from "@/components/action-form";
import { ComboSelect } from "@/components/combo-select";
import { DateInput } from "@/components/date-input";
import type { ClientOpt } from "@/lib/docs/client-opts";

type Row = { key: number; desc: string; monto: string };
export type ReciboInitial = { clientId: string; clienteNombre: string; clienteEmpresa: string; fecha: string; recibe: string; incluirFirma: boolean; rows: { desc: string; monto: string }[]; folio?: string };

const total = (rows: Row[]) => rows.reduce((s, r) => s + (Number(r.monto.replace(/[\s$,]/g, "")) || 0), 0);
const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Formulario del recibo de pago: varios conceptos, total automático y folio asignado solo. */
export function ReciboForm({ docId, clients, recibe, today, initial }: { docId?: string; clients: ClientOpt[]; recibe: { nombre: string; hasFirma: boolean }[]; today: string; initial?: ReciboInitial }) {
  const [v, setV] = useState({
    clientId: initial?.clientId ?? "", clienteNombre: initial?.clienteNombre ?? "", clienteEmpresa: initial?.clienteEmpresa ?? "",
    fecha: initial?.fecha ?? today, recibe: initial?.recibe ?? recibe[0]?.nombre ?? "", incluirFirma: initial?.incluirFirma ?? true,
  });
  const [rows, setRows] = useState<Row[]>((initial?.rows.length ? initial.rows : [{ desc: "", monto: "" }]).map((r, i) => ({ key: i, ...r })));
  const [next, setNext] = useState(100);
  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const bound = saveRecibo.bind(null, docId ?? null);
  const client = clients.find((c) => c.id === v.clientId);
  const person = recibe.find((p) => p.nombre === v.recibe);

  function pick(id: string) {
    const c = clients.find((x) => x.id === id);
    setV((s) => ({ ...s, clientId: id, clienteEmpresa: c?.name ?? s.clienteEmpresa, clienteNombre: c?.contacto ?? s.clienteNombre }));
  }

  if (recibe.length === 0) {
    return <div className="card text-sm">Antes de hacer recibos hay que registrar a las personas que pueden «Confirmar de recibido» en <strong>Documentos › Configuración</strong>. Pídeselo al Administrador.</div>;
  }

  return (
    <ActionForm action={bound} submitLabel="Guardar y ver vista previa" resetOnSuccess={false} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Cliente y fecha</h2>
        <div className="max-w-md">
          <label className="label">Cliente del portal</label>
          {docId ? (
            <>
              <input type="hidden" name="clientId" value={v.clientId} />
              <input className="input" value={client?.name ?? ""} readOnly tabIndex={-1} />
            </>
          ) : (
            <ComboSelect name="clientId" required options={clients.map((c) => ({ id: c.id, label: c.name }))} value={v.clientId} onChange={pick} placeholder="Escribe para buscar un cliente…" />
          )}
          <p className="mt-1 text-xs text-zinc-500">
            {initial?.folio ? `Folio: ${initial.folio}` : client ? `El folio será ${client.prefix}${String(client.nextReceipt).padStart(2, "0")} (prefijo del cliente y consecutivo).` : "El folio se asigna solo al guardar: prefijo del cliente y consecutivo."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="r-persona">Persona que paga (opcional)</label>
            <input id="r-persona" name="clienteNombre" className="input" maxLength={150} value={v.clienteNombre} onChange={(e) => setV({ ...v, clienteNombre: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="r-empresa">Empresa o cliente</label>
            <input id="r-empresa" name="clienteEmpresa" className="input" required maxLength={255} value={v.clienteEmpresa} onChange={(e) => setV({ ...v, clienteEmpresa: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="r-fecha">Fecha</label>
            <DateInput id="r-fecha" name="fecha" required value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Conceptos</h2>
        {rows.map((r, i) => (
          <div key={r.key} className="grid items-end gap-3 sm:grid-cols-[2rem_1fr_9rem_auto]">
            <span className="pb-2.5 text-sm text-zinc-500">{i + 1}.</span>
            <div>
              {i === 0 && <label className="label">Descripción</label>}
              <input name="cDesc" className="input" maxLength={300} value={r.desc} onChange={(e) => setRow(r.key, { desc: e.target.value })} placeholder="Anticipo para análisis de puesto" />
            </div>
            <div>
              {i === 0 && <label className="label">Total (MXN)</label>}
              <input name="cMonto" className="input" inputMode="decimal" value={r.monto} onChange={(e) => setRow(r.key, { monto: e.target.value })} placeholder="0.00" />
            </div>
            {rows.length > 1 ? (
              <button type="button" aria-label="Quitar este concepto" className="btn-outline px-2.5 py-2.5" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><X size={15} /></button>
            ) : <span />}
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-outline px-3.5 py-1.5 text-xs" onClick={() => { setRows((rs) => [...rs, { key: next, desc: "", monto: "" }]); setNext((n) => n + 1); }}><Plus size={14} /> Agregar otro concepto</button>
          <p className="text-sm">Total: <strong>{fmt(total(rows))}</strong></p>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Confirma de recibido</h2>
        <div className="max-w-md">
          <select name="recibe" className="input" value={v.recibe} onChange={(e) => setV({ ...v, recibe: e.target.value })}>
            {recibe.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
          </select>
        </div>
        {person?.hasFirma ? (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" name="incluirFirma" checked={v.incluirFirma} onChange={(e) => setV({ ...v, incluirFirma: e.target.checked })} className="h-4 w-4 accent-[#007AFF]" />
            Incluir la firma escaneada de {person.nombre}
          </label>
        ) : (
          <p className="text-xs text-zinc-500">Esta persona no tiene firma escaneada; el recibo se firma a mano al imprimirlo (la firma se carga en Documentos › Configuración).</p>
        )}
      </section>
    </ActionForm>
  );
}
