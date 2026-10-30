"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { saveDocsConfigAction } from "@/app/actions/documents";
import { ActionForm } from "@/components/action-form";
import type { DocsConfig } from "@/lib/docs/types";

type Person = { key: number; nombre: string; firmaKey: string; keep: boolean };

/** Datos fijos de la empresa para contratos y acuerdos, cargos de quien firma y personas que confirman de recibido. */
export function ConfigForm({ cfg }: { cfg: DocsConfig }) {
  const [people, setPeople] = useState<Person[]>(() => (cfg.recibe.length ? cfg.recibe : [{ nombre: "", firmaKey: "" }]).map((p, i) => ({ key: i, nombre: p.nombre, firmaKey: p.firmaKey ?? "", keep: true })));
  const [next, setNext] = useState(100);
  const setP = (key: number, patch: Partial<Person>) => setPeople((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const f = (name: keyof DocsConfig, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={`c-${name}`}>{label}</label>
      <input id={`c-${name}`} name={name} className="input" defaultValue={String(cfg[name] ?? "")} {...props} />
    </div>
  );

  return (
    <ActionForm action={saveDocsConfigAction} submitLabel="Guardar configuración" successMessage="Configuración guardada" resetOnSuccess={false} className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Datos de la empresa (para contratos y acuerdos)</h2>
          <p className="meta text-xs">Se capturan una sola vez. Se guardan en el servidor privado del portal, nunca en el código.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {f("razonSocial", "Razón social", { required: true, maxLength: 200 })}
          {f("rfc", "RFC", { required: true, maxLength: 13, style: { textTransform: "uppercase" } })}
          <div className="md:col-span-2">{f("domicilio", "Domicilio social completo", { required: true, maxLength: 400 })}</div>
          {f("repNombre", "Representante: nombre completo", { required: true, maxLength: 150 })}
          {f("repIne", "Representante: número de INE", { required: true, maxLength: 30 })}
          <div className="md:col-span-2">{f("repDomicilio", "Representante: domicilio", { required: true, maxLength: 300 })}</div>
          {f("ciudad", "Ciudad y estado de firma", { required: true, maxLength: 120 })}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Cargos de quien firma por la empresa</h2>
        <p className="meta text-xs">Uno por renglón. Al hacer cada documento se elige uno.</p>
        <textarea name="cargos" rows={4} className="input max-w-md" required defaultValue={cfg.cargos.join("\n")} />
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">«Confirma de recibido» en los recibos</h2>
        <p className="meta text-xs">Personas autorizadas. Puedes subir su firma escaneada (PNG o JPG con fondo blanco o transparente, hasta 2 MB) para que aparezca en el recibo.</p>
        {people.map((p) => (
          <div key={p.key} className="grid items-end gap-3 sm:grid-cols-[1fr_16rem_auto]">
            <div>
              <label className="label">Nombre</label>
              <input name="pNombre" className="input" maxLength={150} value={p.nombre} onChange={(e) => setP(p.key, { nombre: e.target.value })} placeholder="Nombre completo" />
              <input type="hidden" name="pFirma" value={p.firmaKey} />
              <input type="hidden" name="pKeep" value={p.keep ? "1" : "0"} />
            </div>
            <div>
              <label className="label">Firma escaneada</label>
              <input type="file" name="pFile" accept="image/png,image/jpeg" className="input !py-1.5 text-xs" />
              {p.firmaKey && (
                <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
                  <input type="checkbox" checked={!p.keep} onChange={(e) => setP(p.key, { keep: !e.target.checked })} className="h-3.5 w-3.5 accent-[#007AFF]" /> Quitar la firma actual
                </label>
              )}
            </div>
            {people.length > 1 ? (
              <button type="button" aria-label="Quitar a esta persona" className="btn-outline px-2.5 py-2.5" onClick={() => setPeople((ps) => ps.filter((x) => x.key !== p.key))}><X size={15} /></button>
            ) : <span />}
          </div>
        ))}
        <button type="button" className="btn-outline px-3.5 py-1.5 text-xs" onClick={() => { setPeople((ps) => [...ps, { key: next, nombre: "", firmaKey: "", keep: true }]); setNext((n) => n + 1); }}><Plus size={14} /> Agregar persona</button>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Contacto en el pie de reportes y recibos</h2>
          <p className="meta text-xs">Aparece al final de cada reporte en PDF y en la franja inferior de los recibos.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {f("contactEmail", "Correo de contacto", { type: "email", required: true, maxLength: 191 })}
          {f("contactPhones", "Teléfonos (como se mostrarán)", { required: true, maxLength: 80, placeholder: "999 136 4441 · 999 111 8063" })}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Correos</h2>
        <div className="max-w-md">{f("bcc", "Copia oculta de cada envío", { type: "email", maxLength: 191, placeholder: "necesito@311consultores.com" })}</div>
        <div className="max-w-md">
          {f("emailRescision", "Correo para notificar la rescisión por falta de pago (contratos)", { type: "email", maxLength: 191 })}
          <p className="mt-1 text-xs text-zinc-500">Aparece en la cláusula de rescisión del contrato; en cada contrato se puede cambiar.</p>
        </div>
      </section>
    </ActionForm>
  );
}
