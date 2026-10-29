"use client";

import { useState } from "react";
import { addLoanPayment } from "@/app/actions/loans";
import { ActionForm } from "@/components/action-form";
import { DateInput } from "@/components/date-input";

/** Registro de un abono: el dinero regresa a una de las cajas de las que salió el préstamo. */
export function PaymentForm({ loanId, today, boxes }: { loanId: string; today: string; boxes: { value: string; label: string; pending: string; pendingCents: number }[] }) {
  const open = boxes.filter((b) => b.pendingCents > 0);
  const [box, setBox] = useState(open[0]?.value ?? "");
  const sel = open.find((b) => b.value === box);

  return (
    <ActionForm action={addLoanPayment} submitLabel="Registrar abono" successMessage="Abono registrado" className="space-y-3">
      <input type="hidden" name="loanId" value={loanId} />
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="label">Regresa a la caja</label>
          <select name="box" className="input" value={box} onChange={(e) => setBox(e.target.value)}>
            {open.map((b) => <option key={b.value} value={b.value}>{b.label} (faltan {b.pending})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Entra como</label>
          <select name="cashType" className="input" defaultValue="BANCO">
            <option value="EFECTIVO">Efectivo</option>
            <option value="BANCO">Banco</option>
          </select>
        </div>
        <div>
          <label className="label">Monto (MXN)</label>
          <input name="amount" required inputMode="decimal" className="input" placeholder={sel ? (sel.pendingCents / 100).toFixed(2) : "0.00"} />
        </div>
        <div>
          <label className="label">Fecha</label>
          <DateInput name="paidOn" required defaultValue={today} max={today} />
        </div>
      </div>
      <div>
        <label className="label">Nota (opcional)</label>
        <input name="note" maxLength={191} className="input max-w-xl" placeholder="Abono con el cobro de la factura …" />
      </div>
    </ActionForm>
  );
}
