"use client";

import { useState, useTransition } from "react";
import type { Box } from "@prisma/client";
import { Modal } from "@/components/modal";
import { BOXES, CASH_LABEL } from "@/lib/ledger-shared";
import { formatCents, parseMoney } from "@/lib/finance";
import { cn } from "@/lib/utils";

/** Saldos de las cajas para mostrarlos en el modal: clave «CAJA:EFECTIVO» o «CAJA:BANCO», en centavos. */
export type BalanceMap = Record<string, number>;

/** Monto con signo («-250» o «500») en centavos; vacío = 0; null si no es válido. */
function parseSigned(text: string): number | null {
  const t = text.trim();
  if (!t) return 0;
  const neg = t.startsWith("-");
  const v = parseMoney(neg ? t.slice(1) : t.replace(/^[+]/, ""));
  return v === null ? null : neg ? -v : v;
}

const seg = (active: boolean) =>
  cn("cursor-pointer rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ease-out", active ? "bg-[#007AFF] text-white shadow-sm" : "glass text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10");

/**
 * Modal para pagar un monto: se elige la caja (o ya viene fija) y cómo se divide entre efectivo y banco.
 * Lo usan los reembolsos y los pagos de nómina. `onPay` recibe la caja y los montos escritos.
 */
export function PaySplitModal({ open, onClose, title, subtitle, totalCents, fixedBox, boxes, balances, confirmLabel = "Registrar pago", adjustable = false, onPay }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  totalCents: number;
  fixedBox?: Box;
  boxes?: Box[]; // cajas entre las que se puede elegir (si no viene fija)
  balances: BalanceMap;
  confirmLabel?: string;
  adjustable?: boolean; // permite sumar o restar un ajuste al monto (bono o descuento) con su motivo
  onPay: (v: { box: Box; cash: string; bank: string; adjustment: string; note: string }) => Promise<{ error?: string }>;
}) {
  const options = BOXES.filter((b) => (boxes ? boxes.includes(b.value) : b.group === "operativa" && b.value !== "DEV"));
  const [box, setBox] = useState<Box | "">(fixedBox ?? "");
  const [method, setMethod] = useState<"EFECTIVO" | "BANCO" | "COMBINADO">("EFECTIVO");
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [adj, setAdj] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();

  const have = (type: "EFECTIVO" | "BANCO") => (box ? balances[`${box}:${type}`] ?? 0 : 0);
  const adjCents = adjustable ? parseSigned(adj) ?? 0 : 0;
  const payCents = totalCents + adjCents; // lo que realmente se paga
  const c = method === "EFECTIVO" ? payCents : method === "BANCO" ? 0 : parseMoney(cash) ?? 0;
  const b = method === "BANCO" ? payCents : method === "EFECTIVO" ? 0 : parseMoney(bank) ?? 0;
  const rest = payCents - c - b;

  function submit() {
    setError(undefined);
    if (!box) return setError("Elige la caja de la que saldrá el pago");
    if (adjustable && parseSigned(adj) === null) return setError("El ajuste debe ser un monto (por ejemplo 500 o -250)");
    if (payCents <= 0) return setError("El total a pagar debe ser mayor a cero");
    if (method === "COMBINADO" && rest !== 0) return setError(`Efectivo + banco debe sumar ${formatCents(payCents)} (faltan ${formatCents(rest)})`);
    start(async () => {
      const r = await onPay({ box, cash: c > 0 ? (c / 100).toFixed(2) : "", bank: b > 0 ? (b / 100).toFixed(2) : "", adjustment: adjustable ? adj : "", note });
      if (r.error) setError(r.error);
      else onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="space-y-4">
        <p className="text-sm">{adjustable ? "Monto de la nómina" : "Monto a pagar"}: <strong>{formatCents(totalCents)}</strong></p>
        {adjustable && (
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div>
              <label className="label" htmlFor="pay-adj">Ajuste de este pago (opcional)</label>
              <input id="pay-adj" className="input" inputMode="decimal" placeholder="+500 o -250" value={adj} onChange={(e) => setAdj(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pay-note">Motivo del ajuste</label>
              <input id="pay-note" className="input" maxLength={300} placeholder="Bono, descuento por falta…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {adjCents !== 0 && <p className="text-sm sm:col-span-2">Total que se pagará: <strong>{formatCents(payCents)}</strong></p>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="pay-box">Caja de la que sale el pago</label>
          {fixedBox ? (
            <p className="text-sm font-medium">{BOXES.find((x) => x.value === fixedBox)?.label}</p>
          ) : (
            <select id="pay-box" className="input" value={box} onChange={(e) => setBox(e.target.value as Box)}>
              <option value="">Elige la caja…</option>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {box && <p className="mt-1 text-xs text-zinc-500">Saldo: efectivo {formatCents(have("EFECTIVO"))} · banco {formatCents(have("BANCO"))}</p>}
        </div>
        <div>
          <p className="label">¿Cómo se paga?</p>
          <div className="flex flex-wrap gap-2">
            {(["EFECTIVO", "BANCO", "COMBINADO"] as const).map((m) => (
              <button key={m} type="button" className={seg(method === m)} onClick={() => setMethod(m)}>{m === "COMBINADO" ? "Combinado" : CASH_LABEL[m]}</button>
            ))}
          </div>
        </div>
        {method === "COMBINADO" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pay-cash">Efectivo</label>
              <input id="pay-cash" className="input" inputMode="decimal" placeholder="0.00" value={cash} onChange={(e) => setCash(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pay-bank">Banco</label>
              <input id="pay-bank" className="input" inputMode="decimal" placeholder="0.00" value={bank} onChange={(e) => setBank(e.target.value)} />
            </div>
            <p className={cn("text-xs sm:col-span-2", rest === 0 ? "text-[#248A3D]" : "text-zinc-500")}>{rest === 0 ? "✔ La suma coincide" : `Faltan por repartir ${formatCents(rest)}`}</p>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn" disabled={busy} onClick={submit}>{busy ? "Registrando…" : confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
