"use client";

import { useState } from "react";
import { createDirectIncome } from "@/app/actions/income";
import { ActionForm } from "@/components/action-form";
import { DateInput } from "@/components/date-input";

export type IncomeClientOption = { id: string; name: string; projects: { id: string; name: string }[] };

/**
 * Ingreso directo a una caja: suma tal cual a la caja, sin el reparto de un cobro.
 * Lleva concepto, motivo, monto, fecha y procedencia (cliente y proyecto opcionales, u «Otro» indicando de dónde viene).
 */
export function DirectIncomeForm({ box, boxName, today, clients }: { box: string; boxName: string; today: string; clients: IncomeClientOption[] }) {
  const [origin, setOrigin] = useState<"CLIENTE" | "OTRO">("CLIENTE");
  const [clientId, setClientId] = useState("");
  const projects = clients.find((c) => c.id === clientId)?.projects ?? [];

  return (
    <ActionForm action={createDirectIncome} submitLabel="Registrar ingreso" successMessage="Ingreso registrado en la caja" className="space-y-4" onSuccess={() => { setOrigin("CLIENTE"); setClientId(""); }}>
      <input type="hidden" name="box" value={box} />
      <p className="text-sm text-zinc-500">Suma directo a la caja <strong>{boxName}</strong>, sin pasar por el reparto de un cobro (porcentajes ni deducciones).</p>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_10rem_11rem]">
        <div>
          <label className="label" htmlFor="di-concept">Concepto</label>
          <input id="di-concept" name="concept" required maxLength={200} className="input" placeholder="Ej. Rendimientos de la inversión" />
        </div>
        <div>
          <label className="label" htmlFor="di-reason">Motivo del ingreso</label>
          <input id="di-reason" name="reason" required maxLength={300} className="input" placeholder="Ej. Aportación extraordinaria" />
        </div>
        <div>
          <label className="label" htmlFor="di-amount">Monto (MXN)</label>
          <input id="di-amount" name="amount" required inputMode="decimal" className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="label" htmlFor="di-date">Fecha</label>
          <DateInput id="di-date" name="occurredOn" required defaultValue={today} max={today} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label" htmlFor="di-type">Entra como</label>
          <select id="di-type" name="cashType" className="input" defaultValue="BANCO" required>
            <option value="BANCO">Banco</option>
            <option value="EFECTIVO">Efectivo</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="di-origin">Procedencia</label>
          <select id="di-origin" name="origin" className="input" value={origin} onChange={(e) => setOrigin(e.target.value as "CLIENTE" | "OTRO")}>
            <option value="CLIENTE">Cliente / proyecto</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        {origin === "CLIENTE" ? (
          <>
            <div>
              <label className="label" htmlFor="di-client">Cliente (opcional)</label>
              <select id="di-client" name="clientId" className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Ninguno</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="di-project">Proyecto (opcional)</label>
              <select id="di-project" name="projectId" className="input" disabled={!clientId}>
                <option value="">Ninguno</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </>
        ) : (
          <div className="md:col-span-2">
            <label className="label" htmlFor="di-origin-note">¿De dónde viene este ingreso?</label>
            <input id="di-origin-note" name="originNote" required maxLength={200} className="input" placeholder="Ej. Rendimientos del banco, aportación de un socio…" />
          </div>
        )}
      </div>
    </ActionForm>
  );
}
