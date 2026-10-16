"use client";

import { useState } from "react";
import { createMovement } from "@/app/actions/finance";
import { ActionForm } from "@/components/action-form";
import { DateInput } from "@/components/date-input";
import { BOXES } from "@/lib/ledger-shared";

type Kind = "SALDO_INICIAL" | "TRASLADO" | "RETIRO";

const KINDS: { value: Kind; label: string; help: string }[] = [
  { value: "SALDO_INICIAL", label: "Saldo inicial", help: "Dinero que ya había en una caja al empezar a usar el sistema (o un ajuste a favor)." },
  { value: "TRASLADO", label: "Traslado entre cajas", help: "Mueve dinero de una caja a otra, o de efectivo a banco dentro de la misma caja (por ejemplo, completar la nómina con dinero de la caja Gastos)." },
  { value: "RETIRO", label: "Retiro", help: "Dinero que sale de la empresa: pago de impuestos, reparto de utilidad a un socio, etc." },
];

const BoxSelect = ({ prefix }: { prefix: "from" | "to" }) => (
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="label">Caja</label>
      <select name={`${prefix}Box`} required className="input" defaultValue="">
        <option value="" disabled>Selecciona…</option>
        {BOXES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
    </div>
    <div>
      <label className="label">Tipo de saldo</label>
      <select name={`${prefix}Type`} required className="input" defaultValue="">
        <option value="" disabled>Selecciona…</option>
        <option value="EFECTIVO">Efectivo</option>
        <option value="BANCO">Banco</option>
      </select>
    </div>
  </div>
);

export function MovementForm({ today }: { today: string }) {
  const [kind, setKind] = useState<Kind>("SALDO_INICIAL");
  const info = KINDS.find((k) => k.value === kind)!;

  return (
    <ActionForm action={createMovement} submitLabel="Registrar movimiento" successMessage="Movimiento registrado" className="space-y-4">
      <div>
        <label className="label">Tipo de movimiento</label>
        <select name="kind" className="input max-w-sm" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-zinc-500">{info.help}</p>
      </div>
      <div key={kind} className="grid gap-4 md:grid-cols-2">
        {kind !== "SALDO_INICIAL" && (
          <fieldset className="space-y-2 rounded-xl border border-black/5 p-3 dark:border-white/10">
            <legend className="px-1 text-sm font-semibold">Sale de</legend>
            <BoxSelect prefix="from" />
          </fieldset>
        )}
        {kind !== "RETIRO" && (
          <fieldset className="space-y-2 rounded-xl border border-black/5 p-3 dark:border-white/10">
            <legend className="px-1 text-sm font-semibold">Entra a</legend>
            <BoxSelect prefix="to" />
          </fieldset>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label">Monto (MXN)</label>
          <input name="amount" required inputMode="decimal" className="input" placeholder="0.00" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Concepto</label>
          <input name="concept" required maxLength={200} className="input" placeholder={kind === "SALDO_INICIAL" ? "Saldo inicial al arrancar el sistema" : kind === "RETIRO" ? "Pago de impuestos del mes" : "Para completar nómina"} />
        </div>
        <div>
          <label className="label">Fecha</label>
          <DateInput name="occurredOn" required defaultValue={today} max={today} />
        </div>
      </div>
    </ActionForm>
  );
}
