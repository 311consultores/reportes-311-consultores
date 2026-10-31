"use client";

import { useState } from "react";
import { saveSplit } from "@/app/actions/finance";
import { ActionForm } from "@/components/action-form";
import { bpsToPercent, percentToBps, SPLIT_FIELDS, SPLIT_NET_GROUP, utilityBps, type SplitConfig } from "@/lib/ledger-shared";

const shown = (bps: number) => `${bpsToPercent(bps) || "0"} %`;

export function SplitForm({ config }: { config: SplitConfig }) {
  const groups = [...new Set(SPLIT_FIELDS.map((f) => f.group))];
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(SPLIT_FIELDS.map((f) => [f.key, bpsToPercent(config[f.key])])));

  // La utilidad general se calcula sola con lo que está escrito en el formulario
  const bps = (k: keyof SplitConfig) => percentToBps(vals[k] ?? "") ?? 0;
  const util = utilityBps({ nomina: bps("nomina"), ahorro: bps("ahorro"), navidad: bps("navidad"), gastos: bps("gastos") });
  const partner = Math.round((util * bps("socio")) / 10000); // lo que recibe cada socio, como % de la base

  return (
    <ActionForm action={saveSplit} submitLabel="Guardar porcentajes" successMessage="Porcentajes guardados. Se aplicarán a los próximos cobros." resetOnSuccess={false} className="space-y-6">
      {groups.map((g) => (
        <fieldset key={g} className="space-y-3 rounded-2xl border border-black/5 p-5 dark:border-white/10">
          <legend className="px-2 text-sm font-semibold tracking-tight">{g}</legend>
          <div className="grid gap-4 md:grid-cols-3">
            {SPLIT_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={f.key}>{f.label}</label>
                <div className="relative">
                  <input id={f.key} name={f.key} required inputMode="decimal" className="input pr-8" value={vals[f.key]} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">%</span>
                </div>
                {f.key === "socio" && <p className="mt-1 text-xs text-zinc-500">Equivale a <strong>{shown(partner)}</strong> del ingreso neto para cada socio.</p>}
              </div>
            ))}
            {g === SPLIT_NET_GROUP && (
              <div>
                <label className="label" htmlFor="utilidad-general">Utilidad general</label>
                <div className="relative">
                  <input id="utilidad-general" readOnly tabIndex={-1} className="input pr-8 font-semibold" value={bpsToPercent(util) || "0"} aria-describedby="utilidad-general-hint" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">%</span>
                </div>
                <p id="utilidad-general-hint" className="mt-1 text-xs text-zinc-500">Se calcula sola: 100 % menos Nómina, Ahorro, Navidad y Gastos.</p>
                {util < 0 && <p className="mt-1 text-xs text-destructive">Los porcentajes suman más de 100 %.</p>}
              </div>
            )}
          </div>
        </fieldset>
      ))}
    </ActionForm>
  );
}
