"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { saveContrato } from "@/app/actions/documents";
import { ActionForm } from "@/components/action-form";
import { ComboSelect } from "@/components/combo-select";
import { DateInput } from "@/components/date-input";
import type { ClientOpt } from "@/lib/docs/client-opts";
import { moneyShort } from "@/lib/docs/text";

export type ContratoInitial = {
  clientId: string; razon: string; clienteDomicilio: string; repNombre: string; repDomicilio: string; repCurp: string; repIne: string; repRol: string;
  fecha: string; cargo: string; ramo: string; meses: number; anios: number; penalidadPct: number; prorrogaDias: number; emailRescision: string;
  extraTitulo: string; extraTexto: string;
  servicios: string[]; // ids del catálogo marcados
  serviciosExtra: string[]; // servicios escritos a mano
  pagos: { key: number; mes: string; monto: string; iva: boolean }[];
};

type Base = { id: string; text: string };

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** «Noviembre 2026» → «Diciembre 2026» (para sugerir el siguiente renglón del calendario de pagos). */
function nextMonth(s: string): string {
  const m = s.trim().match(/^(\S+)\s+(\d{4})$/);
  const i = m ? MESES.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()) : -1;
  if (!m || i < 0) return "";
  return i === 11 ? `${MESES[0]} ${Number(m[2]) + 1}` : `${MESES[i + 1]} ${m[2]}`;
}

/** Formulario del contrato: servicios con casillas, calendario de pagos por renglón y parámetros de duración y penalidad. */
export function ContratoForm({ docId, clients, cargos, catalog, today, defaultEmail, initial }: {
  docId?: string; clients: ClientOpt[]; cargos: string[]; catalog: Base[]; today: string; defaultEmail: string; initial?: ContratoInitial;
}) {
  const [v, setV] = useState<ContratoInitial>(initial ?? {
    clientId: "", razon: "", clienteDomicilio: "", repNombre: "", repDomicilio: "", repCurp: "", repIne: "", repRol: "Representante Legal",
    fecha: today, cargo: cargos[0] ?? "", ramo: "", meses: 5, anios: 2, penalidadPct: 20, prorrogaDias: 10, emailRescision: defaultEmail,
    extraTitulo: "", extraTexto: "", servicios: catalog.map((s) => s.id), serviciosExtra: [],
    pagos: [{ key: 1, mes: "", monto: "", iva: true }],
  });
  const [nextKey, setNextKey] = useState(100);
  const [mesesTouched, setMesesTouched] = useState(!!initial);
  const set = (patch: Partial<ContratoInitial>) => setV((s) => ({ ...s, ...patch }));
  const bound = saveContrato.bind(null, docId ?? null);

  const setPago = (key: number, patch: Partial<ContratoInitial["pagos"][number]>) => set({ pagos: v.pagos.map((p) => (p.key === key ? { ...p, ...patch } : p)) });
  function addPago() {
    const last = v.pagos[v.pagos.length - 1];
    const pagos = [...v.pagos, { key: nextKey, mes: last ? nextMonth(last.mes) : "", monto: last?.monto ?? "", iva: last?.iva ?? true }];
    setNextKey((n) => n + 1);
    set(mesesTouched ? { pagos } : { pagos, meses: pagos.length });
  }
  function removePago(key: number) {
    const pagos = v.pagos.filter((p) => p.key !== key);
    set(mesesTouched ? { pagos } : { pagos, meses: Math.max(1, pagos.length) });
  }
  const total = v.pagos.reduce((s, p) => s + Math.round((Number(p.monto.replace(/[$,\s]/g, "")) || 0) * 100), 0);

  function pick(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return set({ clientId: id });
    set({
      clientId: id, razon: c.razon, clienteDomicilio: c.domicilio,
      repNombre: c.rep.nombre, repDomicilio: c.rep.domicilio, repCurp: c.rep.curp, repIne: c.rep.ine, repRol: c.rep.rol || "Representante Legal",
    });
  }
  type TextKey = Exclude<keyof ContratoInitial, "servicios" | "serviciosExtra" | "pagos">;
  const field = (name: TextKey, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} className="input" value={String(v[name])} onChange={(e) => set({ [name]: e.target.value } as Partial<ContratoInitial>)} {...props} />
    </div>
  );

  return (
    <ActionForm action={bound} submitLabel="Guardar y ver vista previa" resetOnSuccess={false} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Cliente</h2>
        <div className="max-w-md">
          <label className="label">Cliente del portal</label>
          <ComboSelect name="clientId" required options={clients.map((c) => ({ id: c.id, label: c.name }))} value={v.clientId} onChange={pick} placeholder="Escribe para buscar un cliente…" />
          <p className="mt-1 text-xs text-zinc-500">Al elegirlo se llenan solos los datos que el portal ya tiene de él; puedes corregirlos.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {field("razon", "Razón social del cliente", { required: true, maxLength: 255 })}
          {field("clienteDomicilio", "Domicilio de la empresa (opcional)", { maxLength: 400 })}
          {field("ramo", "Ramo o giro del cliente", { required: true, maxLength: 120, placeholder: "ferretero" })}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Representante legal del cliente</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {field("repNombre", "Nombre completo", { required: true, maxLength: 150 })}
          {field("repRol", "Cargo o rol", { maxLength: 120 })}
          {field("repDomicilio", "Domicilio del representante", { required: true, maxLength: 300 })}
          {field("repCurp", "CURP (18 caracteres)", { required: true, maxLength: 18, minLength: 18, style: { textTransform: "uppercase" } })}
          {field("repIne", "Clave de elector (INE)", { required: true, maxLength: 20, style: { textTransform: "uppercase" } })}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" name="saveRep" defaultChecked className="mt-0.5 h-4 w-4 accent-[#007AFF]" />
          <span>Guardar estos datos en el cliente para no capturarlos otra vez. <span className="block text-xs text-zinc-500">Solo los ven el ADMINISTRADOR y el EDITOR.</span></span>
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Servicios del contrato</h2>
        <p className="meta text-xs">Marca los que aplican; en el contrato salen como A, B, C… en ese orden. Puedes agregar otros.</p>
        {catalog.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" name="servicio" value={s.id} className="mt-0.5 h-4 w-4 accent-[#007AFF]" checked={v.servicios.includes(s.id)}
              onChange={(e) => set({ servicios: e.target.checked ? [...v.servicios, s.id] : v.servicios.filter((x) => x !== s.id) })} />
            <span>{s.text.replace(/\*\*/g, "")}</span>
          </label>
        ))}
        {v.serviciosExtra.map((t, i) => (
          <div key={i} className="flex items-start gap-2">
            <textarea name="servicioExtra" rows={2} maxLength={600} className="input" value={t} placeholder="Título: descripción del servicio"
              onChange={(e) => set({ serviciosExtra: v.serviciosExtra.map((x, j) => (j === i ? e.target.value : x)) })} />
            <button type="button" aria-label="Quitar este servicio" className="btn-outline px-2.5 py-2.5" onClick={() => set({ serviciosExtra: v.serviciosExtra.filter((_, j) => j !== i) })}><X size={15} /></button>
          </div>
        ))}
        <button type="button" className="btn-outline px-3.5 py-1.5 text-xs" onClick={() => set({ serviciosExtra: [...v.serviciosExtra, ""] })}><Plus size={14} /> Agregar otro servicio</button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Calendario de pagos</h2>
        <p className="meta text-xs">Un renglón por pago. El total y el monto en letra se calculan solos.</p>
        {v.pagos.map((p) => (
          <div key={p.key} className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_auto_auto]">
            <div>
              <label className="label">Mes</label>
              <input name="pMes" className="input" maxLength={40} value={p.mes} placeholder="Noviembre 2026" onChange={(e) => setPago(p.key, { mes: e.target.value })} />
            </div>
            <div>
              <label className="label">Monto (MXN)</label>
              <input name="pMonto" className="input" inputMode="decimal" value={p.monto} placeholder="22500.00" onChange={(e) => setPago(p.key, { monto: e.target.value })} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm">
              <input type="hidden" name="pIva" value={p.iva ? "1" : "0"} />
              <input type="checkbox" checked={p.iva} onChange={(e) => setPago(p.key, { iva: e.target.checked })} className="h-4 w-4 accent-[#007AFF]" /> + IVA
            </label>
            {v.pagos.length > 1 ? (
              <button type="button" aria-label="Quitar este pago" className="btn-outline px-2.5 py-2.5" onClick={() => removePago(p.key)}><X size={15} /></button>
            ) : <span />}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="btn-outline px-3.5 py-1.5 text-xs" onClick={addPago}><Plus size={14} /> Agregar pago</button>
          <span className="text-sm font-medium">Total del contrato: {moneyShort(total)}</span>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Datos del contrato</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="f-fecha">Fecha de firma</label>
            <DateInput id="f-fecha" name="fecha" required value={v.fecha} onChange={(e) => set({ fecha: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="f-cargo">Cargo de quien firma por la empresa</label>
            <select id="f-cargo" name="cargo" className="input" value={v.cargo} onChange={(e) => set({ cargo: e.target.value })}>
              {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-meses">Duración (meses)</label>
            <input id="f-meses" name="meses" type="number" min={1} max={120} required className="input" value={v.meses} onChange={(e) => { setMesesTouched(true); set({ meses: Number(e.target.value) }); }} />
          </div>
          {field("anios", "Años de confidencialidad después de terminar", { type: "number", min: 0, max: 30, required: true })}
          {field("penalidadPct", "Penalidad por rescisión unilateral (%)", { type: "number", min: 1, max: 100, required: true })}
          {field("prorrogaDias", "Prórroga para pagar (días hábiles)", { type: "number", min: 0, max: 60, required: true })}
          <div className="md:col-span-2">{field("emailRescision", "Correo para notificar la rescisión por falta de pago", { type: "email", required: true, maxLength: 191 })}</div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Cláusula adicional (opcional)</h2>
        <p className="meta text-xs">Si la llenas, se agrega al final, antes de las firmas, como una cláusula más.</p>
        {field("extraTitulo", "Título de la cláusula", { maxLength: 150, placeholder: "Notificaciones" })}
        <div>
          <label className="label" htmlFor="f-extraTexto">Texto</label>
          <textarea id="f-extraTexto" name="extraTexto" rows={4} maxLength={5000} className="input" value={v.extraTexto} onChange={(e) => set({ extraTexto: e.target.value })} />
        </div>
      </section>
    </ActionForm>
  );
}
