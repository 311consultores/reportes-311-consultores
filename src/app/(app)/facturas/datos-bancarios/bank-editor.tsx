"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { saveBankData } from "@/app/actions/invoices";
import type { BankAccount } from "@/lib/invoices";

const EMPTY: BankAccount = { title: "", holder: "", rfc: "", bank: "", clabe: "", account: "", card: "" };

const FIELDS: { key: keyof BankAccount; label: string; wide?: boolean; max: number }[] = [
  { key: "title", label: "Nombre de la cuenta (p. ej. FACTURA TRIADA)", wide: true, max: 80 },
  { key: "holder", label: "Titular", wide: true, max: 120 },
  { key: "rfc", label: "RFC", max: 13 },
  { key: "bank", label: "Banco", max: 60 },
  { key: "clabe", label: "CLABE", max: 18 },
  { key: "account", label: "Cuenta", max: 30 },
  { key: "card", label: "Tarjeta", max: 25 },
];

/** Alta y edición de las cuentas para recibir pagos (solo Administrador). */
export function BankEditor({ initial }: { initial: BankAccount[] }) {
  const router = useRouter();
  const [items, setItems] = useState<BankAccount[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, start] = useTransition();

  const set = (i: number, key: keyof BankAccount, value: string) =>
    setItems((prev) => prev.map((a, j) => (j === i ? { ...a, [key]: value } : a)));

  function save() {
    setMsg(undefined);
    start(async () => {
      const r = await saveBankData(JSON.stringify(items));
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: "Datos guardados" });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {items.map((a, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-black/5 p-4 dark:border-white/10">
          <div className="grid gap-3 md:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? "md:col-span-3" : ""}>
                <label className="label">{f.label}</label>
                <input className="input" maxLength={f.max} value={a[f.key]} onChange={(e) => set(i, f.key, e.target.value)} />
              </div>
            ))}
          </div>
          <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-[#FF3B30] hover:opacity-70" onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>
            <Trash2 size={13} /> Quitar esta cuenta
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-outline" onClick={() => setItems((p) => [...p, { ...EMPTY }])}>
          <Plus size={16} /> Agregar cuenta
        </button>
        <button type="button" className="btn" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar datos bancarios"}</button>
        {msg && <span className={msg.ok ? "text-sm text-[#248A3D] dark:text-[#30D158]" : "text-sm text-destructive"}>{msg.text}</span>}
      </div>
    </div>
  );
}
