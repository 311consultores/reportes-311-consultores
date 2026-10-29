"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { createReport } from "@/app/actions/reports";
import type { ProjectInfo } from "@/app/actions/admin";
import { ProjectModal } from "@/components/project-modal";
import { ActionForm } from "@/components/action-form";
import { SearchSelect } from "@/components/search-select";
import { DateInput } from "@/components/date-input";
import { ConsultantPicker, type TeamOption } from "@/components/consultant-picker";

type ClientOpt = { id: string; companyName: string; mainEmails: string; projects: ProjectInfo[] };

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};

export function NewReportForm({ clients: initialClients, team, initialConsultants, canManage }: { clients: ClientOpt[]; team: TeamOption[]; initialConsultants: string[]; canManage: boolean }) {
  const [clients, setClients] = useState(initialClients);
  const [modal, setModal] = useState<null | "crear" | "editar">(null);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [endTouched, setEndTouched] = useState(false);

  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.companyName })), [clients]);
  const client = clients.find((c) => c.id === clientId);
  const projects = client?.projects ?? [];
  const current = projects.find((p) => p.id === projectId);
  /** Agrega o reemplaza un proyecto en la lista local (sin recargar la página). */
  const upsert = (cid: string, p: ProjectInfo) =>
    setClients((cs) => cs.map((c) => (c.id !== cid ? c : { ...c, projects: c.projects.some((x) => x.id === p.id) ? c.projects.map((x) => (x.id === p.id ? p : x)) : [...c.projects, p] })));

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
        <div className="flex items-center gap-2">
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
          {canManage && (
            <>
              <button type="button" className="btn-outline shrink-0" disabled={!client} onClick={() => setModal("crear")}><Plus size={16} /> Crear proyecto</button>
              <button type="button" className="btn-outline shrink-0 px-3" aria-label="Editar el proyecto elegido" title="Editar el proyecto elegido" disabled={!current} onClick={() => setModal("editar")}><Pencil size={16} /></button>
            </>
          )}
        </div>
      </div>
      {client && modal === "crear" && (
        <ProjectModal open onClose={() => setModal(null)} client={{ id: client.id, companyName: client.companyName, mainEmails: client.mainEmails }}
          onSaved={(p) => { upsert(client.id, p); setProjectId(p.id); }} />
      )}
      {client && current && modal === "editar" && (
        <ProjectModal open onClose={() => setModal(null)} client={{ id: client.id, companyName: client.companyName, mainEmails: client.mainEmails }} project={current}
          onSaved={(p) => upsert(client.id, p)} />
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha inicial</label>
          <DateInput name="startDate" required
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
          <DateInput name="endDate" required
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
        <label className="label">Consultores</label>
        <ConsultantPicker options={team} initial={initialConsultants} />
      </div>
    </ActionForm>
  );
}
