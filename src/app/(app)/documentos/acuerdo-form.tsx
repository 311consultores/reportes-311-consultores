"use client";

import { useState } from "react";
import { saveAcuerdo } from "@/app/actions/documents";
import { ActionForm } from "@/components/action-form";
import { ComboSelect } from "@/components/combo-select";
import { DateInput } from "@/components/date-input";
import type { ClientOpt } from "@/lib/docs/client-opts";

export type AcuerdoInitial = {
  clientId: string; razon: string; clienteDomicilio: string; repNombre: string; repDomicilio: string; repCurp: string; repIne: string; repRol: string;
  fecha: string; cargo: string; meses: number; anios: number; pena: string; extraTitulo: string; extraTexto: string;
};

/** Formulario del acuerdo de confidencialidad: al elegir el cliente se llenan solos los datos que el portal ya tiene. */
export function AcuerdoForm({ docId, clients, cargos, today, initial }: { docId?: string; clients: ClientOpt[]; cargos: string[]; today: string; initial?: AcuerdoInitial }) {
  const [v, setV] = useState<AcuerdoInitial>(initial ?? {
    clientId: "", razon: "", clienteDomicilio: "", repNombre: "", repDomicilio: "", repCurp: "", repIne: "", repRol: "Representante Legal",
    fecha: today, cargo: cargos[0] ?? "", meses: 6, anios: 2, pena: "50000.00", extraTitulo: "", extraTexto: "",
  });
  const set = (patch: Partial<AcuerdoInitial>) => setV((s) => ({ ...s, ...patch }));
  const bound = saveAcuerdo.bind(null, docId ?? null);

  function pick(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return set({ clientId: id });
    set({
      clientId: id, razon: c.razon, clienteDomicilio: c.domicilio,
      repNombre: c.rep.nombre, repDomicilio: c.rep.domicilio, repCurp: c.rep.curp, repIne: c.rep.ine, repRol: c.rep.rol || "Representante Legal",
    });
  }
  const field = (name: keyof AcuerdoInitial, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} className="input" value={String(v[name])} onChange={(e) => set({ [name]: e.target.value } as Partial<AcuerdoInitial>)} {...props} />
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

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Datos del acuerdo</h2>
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
          {field("meses", "Duración (meses)", { type: "number", min: 1, max: 120, required: true })}
          {field("anios", "Años adicionales de confidencialidad", { type: "number", min: 0, max: 30, required: true })}
          {field("pena", "Pena convencional (MXN)", { inputMode: "decimal", required: true })}
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
