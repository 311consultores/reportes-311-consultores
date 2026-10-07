"use client";

import { useMemo, useState } from "react";
import { createReport } from "@/app/actions/reports";
import { ActionForm } from "@/components/action-form";
import { SearchSelect } from "@/components/search-select";

type ClientOpt = { id: string; companyName: string; projects: { id: string; projectName: string }[] };

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};

export function NewReportForm({ clients }: { clients: ClientOpt[] }) {
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [endTouched, setEndTouched] = useState(false);

  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.companyName })), [clients]);
  const projects = clients.find((c) => c.id === clientId)?.projects ?? [];

  return (
    <ActionForm action={createReport} submitLabel="Crear reporte" className="space-y-4">
      <div>
        <label className="label">Cliente</label>
        <SearchSelect
          name="clientId"
          required
          options={clientOptions}
          value={clientId}
          onChange={(v) => {
            setClientId(v);
            setProjectId("");
          }}
          placeholder="Escribe para buscar un cliente…"
        />
      </div>
      <div>
        <label className="label">Proyecto</label>
        <select
          name="projectId"
          required
          className="input"
          disabled={!clientId}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.projectName}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha inicial</label>
          <input
            type="date"
            name="startDate"
            required
            className="input"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              // Por defecto, un periodo semanal de lunes a viernes (+4 días); se puede cambiar a mano
              if (e.target.value && !endTouched) setEnd(addDays(e.target.value, 4));
            }}
          />
        </div>
        <div>
          <label className="label">Fecha final</label>
          <input
            type="date"
            name="endDate"
            required
            className="input"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setEndTouched(true);
            }}
          />
          <p className="mt-1 text-xs text-zinc-500">Se calcula como la fecha inicial + 4 días; puedes modificarla.</p>
        </div>
      </div>
      <div>
        <label className="label">Consultores (separados por coma)</label>
        <input name="consultants" required placeholder="Ana Pérez, Luis Gómez" className="input" />
      </div>
    </ActionForm>
  );
}
