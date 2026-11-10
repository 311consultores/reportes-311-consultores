"use client";

import { useMemo, useState } from "react";
import { createReview } from "@/app/actions/reviews";
import { ActionForm } from "@/components/action-form";
import { ConsultantPicker, type TeamOption } from "@/components/consultant-picker";
import { DateInput } from "@/components/date-input";
import { EmailPills } from "@/components/email-pills";
import { SearchSelect } from "@/components/search-select";
import { splitEmails, uniqueEmails } from "@/lib/emails";

type ClientOpt = { id: string; companyName: string; mainEmails: string; projects: { id: string; projectName: string; projectEmails: string }[] };

export function NewReviewForm({ clients, team, initialClientId = "" }: { clients: ClientOpt[]; team: TeamOption[]; initialClientId?: string }) {
  const [clientId, setClientId] = useState(initialClientId);
  const [projectId, setProjectId] = useState(() => (initialClientId ? clients.find((c) => c.id === initialClientId)?.projects[0]?.id ?? "" : ""));
  const options = useMemo(() => clients.map((c) => ({ value: c.id, label: c.companyName })), [clients]);
  const client = clients.find((c) => c.id === clientId);
  const project = client?.projects.find((p) => p.id === projectId);
  // Se sugieren los correos del cliente y del proyecto; se pueden quitar o agregar otros
  const suggested = client ? uniqueEmails([...splitEmails(client.mainEmails), ...splitEmails(project?.projectEmails ?? "")]).join(",") : "";

  return (
    <ActionForm action={createReview} submitLabel="Crear y agregar slides" className="space-y-4">
      <div>
        <label className="label">Cliente</label>
        <SearchSelect name="clientId" required options={options} value={clientId} onChange={(v) => { setClientId(v); setProjectId(""); }} placeholder="Escribe para buscar un cliente…" />
      </div>
      <div>
        <label className="label" htmlFor="projectId">Proyecto</label>
        <select id="projectId" name="projectId" required className="input" disabled={!client} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Selecciona…</option>
          {client?.projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="title">Título de la revisión</label>
        <input id="title" name="title" required maxLength={191} className="input" placeholder="Parrilla noviembre 2026" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Ajustes de COPY los atiende</label>
          <ConsultantPicker single options={team} name="copyUserId" hint="Una persona del TEAM 311." searchText="Escribe para buscar a una persona…" />
        </div>
        <div>
          <label className="label">Ajustes de ARTE los atiende</label>
          <ConsultantPicker single options={team} name="artUserId" hint="Una persona del TEAM 311." searchText="Escribe para buscar a una persona…" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="respondBy">El cliente debe responder antes del</label>
        <DateInput id="respondBy" name="respondBy" required />
        <p className="mt-1 text-xs text-zinc-500">Un día antes se le manda un recordatorio.</p>
      </div>
      <div>
        <label className="label">Correos a los que se avisa</label>
        <EmailPills key={`${clientId}-${projectId}`} name="notifyEmails" defaultValue={suggested} required />
        <p className="mt-1 text-xs text-zinc-500">Reciben el aviso cuando se publica la revisión y cuando los ajustes estén listos.</p>
      </div>
    </ActionForm>
  );
}
