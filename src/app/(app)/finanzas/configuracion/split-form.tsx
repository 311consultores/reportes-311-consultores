"use client";

import { saveSplit } from "@/app/actions/finance";
import { ActionForm } from "@/components/action-form";
import { bpsToPercent, SPLIT_FIELDS, type SplitConfig } from "@/lib/ledger-shared";

export function SplitForm({ config }: { config: SplitConfig }) {
  const groups = [...new Set(SPLIT_FIELDS.map((f) => f.group))];
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
                  <input id={f.key} name={f.key} required inputMode="decimal" className="input pr-8" defaultValue={bpsToPercent(config[f.key])} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">%</span>
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </ActionForm>
  );
}
