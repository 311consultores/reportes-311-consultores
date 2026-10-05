"use client";

import { useState } from "react";
import { createReport } from "@/app/actions/reports";
import { ActionForm } from "@/components/action-form";

type ClientOpt = { id: string; companyName: string; projects: { id: string; projectName: string }[] };

export function NewReportForm({ clients }: { clients: ClientOpt[] }) {
  const [clientId, setClientId] = useState("");
  const projects = clients.find((c) => c.id === clientId)?.projects ?? [];

  return (
    <ActionForm action={createReport} submitLabel="Crear reporte" className="space-y-4">
      <div>
        <label className="label">Cliente</label>
        <select name="clientId" required className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecciona…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Proyecto</label>
        <select name="projectId" required className="input" disabled={!clientId}>
          <option value="">Selecciona…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Fecha inicial</label><input type="date" name="startDate" required className="input" /></div>
        <div><label className="label">Fecha final</label><input type="date" name="endDate" required className="input" /></div>
      </div>
      <div>
        <label className="label">Consultores (separados por coma)</label>
        <input name="consultants" required placeholder="Ana Pérez, Luis Gómez" className="input" />
      </div>
    </ActionForm>
  );
}
