"use client";

import { useState } from "react";
import { createExpense } from "@/app/actions/finance";
import { ActionForm } from "@/components/action-form";
import { DateInput } from "@/components/date-input";
import { formatCents, parseMoney } from "@/lib/finance";
import { cn } from "@/lib/utils";

const seg = (active: boolean) =>
  cn(
    "cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out",
    active ? "bg-[#007AFF] text-white shadow-sm" : "glass text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10",
  );

export function ExpenseForm({ today }: { today: string }) {
  const [kind, setKind] = useState<"OTRO" | "NOMINA">("OTRO");
  const [method, setMethod] = useState<"EFECTIVO" | "BANCO" | "COMBINADO">("EFECTIVO");
  const [total, setTotal] = useState("");
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");

  const t = parseMoney(total);
  const c = parseMoney(cash);
  const b = parseMoney(bank);
  const rest = t !== null ? t - (c ?? 0) - (b ?? 0) : null;

  return (
    <ActionForm
      action={createExpense}
      submitLabel="Registrar gasto"
      successMessage="Gasto registrado"
      className="space-y-4"
      onSuccess={() => {
        setTotal("");
        setCash("");
        setBank("");
      }}
    >
      <div className="flex flex-wrap gap-2">
        <label className={seg(kind === "OTRO")}>
          <input type="radio" name="kind" value="OTRO" className="sr-only" checked={kind === "OTRO"} onChange={() => setKind("OTRO")} />
          Otro gasto (caja Gastos)
        </label>
        <label className={seg(kind === "NOMINA")}>
          <input type="radio" name="kind" value="NOMINA" className="sr-only" checked={kind === "NOMINA"} onChange={() => setKind("NOMINA")} />
          Pago de nómina (caja Nómina)
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label">Concepto</label>
          <input name="concept" required maxLength={200} className="input" placeholder={kind === "NOMINA" ? "Nómina semana 42" : "Papelería, comida, transporte…"} />
        </div>
        <div>
          <label className="label">Fecha del gasto</label>
          <DateInput name="occurredOn" required defaultValue={today} max={today} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label">Monto total (MXN)</label>
          <input name="total" required inputMode="decimal" className="input" placeholder="0.00" value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <label className="label">¿De dónde sale el dinero?</label>
          <div className="flex flex-wrap gap-2">
            {(["EFECTIVO", "BANCO", "COMBINADO"] as const).map((m) => (
              <label key={m} className={seg(method === m)}>
                <input type="radio" name="method" value={m} className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                {m === "EFECTIVO" ? "Efectivo" : m === "BANCO" ? "Banco" : "Combinado"}
              </label>
            ))}
          </div>
        </div>
      </div>
      {method === "COMBINADO" && (
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="label">Sale de efectivo</label>
            <input name="cash" inputMode="decimal" className="input" placeholder="0.00" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div>
            <label className="label">Sale de banco</label>
            <input name="bank" inputMode="decimal" className="input" placeholder="0.00" value={bank} onChange={(e) => setBank(e.target.value)} />
          </div>
          <p className={cn("self-end pb-2 text-sm", rest === 0 ? "text-[#248A3D] dark:text-[#30D158]" : "text-[#C93400] dark:text-[#FF9F0A]")}>
            {rest === null ? "Escribe primero el monto total" : rest === 0 ? "Cuadra con el total" : `Falta repartir ${formatCents(rest)}`}
          </p>
        </div>
      )}
    </ActionForm>
  );
}
