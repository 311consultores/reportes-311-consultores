"use client";

import { saveMetricsConfig } from "@/app/actions/metrics";
import { ActionForm } from "@/components/action-form";

/** Umbrales del semáforo y fecha desde la que se mide (solo Administrador). */
export function ConfigForm({ green, amber, since }: { green: number; amber: number; since: string }) {
  return (
    <ActionForm action={saveMetricsConfig} submitLabel="Guardar configuración" successMessage="Configuración guardada" resetOnSuccess={false} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="c-green">Verde desde (%)</label><input id="c-green" name="green" type="number" min={2} max={100} defaultValue={green} required className="input !w-28" /></div>
        <div><label className="label" htmlFor="c-amber">Ámbar desde (%)</label><input id="c-amber" name="amber" type="number" min={1} max={99} defaultValue={amber} required className="input !w-28" /></div>
        <div><label className="label" htmlFor="c-since">Medir desde</label><input id="c-since" name="since" type="date" defaultValue={since} className="input !w-auto" /></div>
      </div>
      <p className="meta text-xs">Rojo es todo lo que queda por debajo del ámbar. Cambiar la fecha «Medir desde» solo agrega o quita periodos de la medición; no modifica ninguna tarea.</p>
    </ActionForm>
  );
}
