"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createLoan } from "@/app/actions/loans";
import { ActionForm } from "@/components/action-form";
import { DateInput } from "@/components/date-input";
import { BOXES } from "@/lib/ledger-shared";

type Row = { key: number; box: string; type: string; amount: string };

export type LoanPrefill = { concept: string; recipient: string; date: string; alreadyDeducted: boolean; rows: { box: string; type: string; amount: string }[] };

/** Alta de un préstamo: de qué cajas salió el dinero (puede ser de varias, en efectivo o banco). */
export function LoanForm({ today, prefill }: { today: string; prefill?: LoanPrefill }) {
  const start = (): Row[] => (prefill?.rows.length ? prefill.rows : [{ box: "", type: "", amount: "" }]).map((r, i) => ({ key: i, ...r }));
  const [rows, setRows] = useState<Row[]>(start);
  const [next, setNext] = useState(100);
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <ActionForm action={createLoan} submitLabel="Registrar préstamo" successMessage="Préstamo registrado" onSuccess={() => setRows([{ key: next, box: "", type: "", amount: "" }])} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label">Concepto</label>
          <input name="concept" required maxLength={200} className="input" defaultValue={prefill?.concept} placeholder="Préstamo de la caja Navidad" />
        </div>
        <div>
          <label className="label">Quién lo recibió</label>
          <input name="recipient" required maxLength={120} className="input" defaultValue={prefill?.recipient} placeholder="La empresa" />
        </div>
        <div>
          <label className="label">Fecha del préstamo</label>
          <DateInput name="loanDate" required defaultValue={prefill?.date ?? today} max={today} />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-black/5 p-3 dark:border-white/10">
        <legend className="px-1 text-sm font-semibold">¿De qué cajas salió el dinero?</legend>
        {rows.map((r) => (
          <div key={r.key} className="grid items-end gap-3 sm:grid-cols-[1fr_9rem_9rem_auto]">
            <div>
              <label className="label">Caja</label>
              <select name="originBox" className="input" value={r.box} onChange={(e) => set(r.key, { box: e.target.value })}>
                <option value="">Selecciona…</option>
                {BOXES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Procedencia</label>
              <select name="originType" className="input" value={r.type} onChange={(e) => set(r.key, { type: e.target.value })}>
                <option value="">Selecciona…</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="BANCO">Banco</option>
              </select>
            </div>
            <div>
              <label className="label">Monto (MXN)</label>
              <input name="originAmount" inputMode="decimal" className="input" placeholder="0.00" value={r.amount} onChange={(e) => set(r.key, { amount: e.target.value })} />
            </div>
            {rows.length > 1 ? (
              <button type="button" aria-label="Quitar esta caja" className="btn-outline px-2.5 py-2.5" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><X size={15} /></button>
            ) : <span />}
          </div>
        ))}
        <button type="button" className="btn-outline px-3.5 py-1.5 text-xs" onClick={() => { setRows((rs) => [...rs, { key: next, box: "", type: "", amount: "" }]); setNext((n) => n + 1); }}>
          <Plus size={14} /> Agregar otra caja
        </button>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" name="alreadyDeducted" defaultChecked={prefill?.alreadyDeducted} className="mt-0.5 h-4 w-4 accent-[#007AFF]" />
        <span>
          <span className="font-medium">Este dinero ya salió de las cajas antes (préstamo anterior).</span>
          <span className="block text-xs text-zinc-500">Márcalo si el retiro ya está registrado en el sistema: solo se anota la deuda y los saldos de las cajas no cambian. Si no lo marcas, el dinero se descuenta de las cajas al registrar el préstamo.</span>
        </span>
      </label>
    </ActionForm>
  );
}
