"use client";

import { useMemo, useState } from "react";
import { createReview } from "@/app/actions/reviews";
import { ActionForm } from "@/components/action-form";
import { DateInput } from "@/components/date-input";
import { EmailPills } from "@/components/email-pills";
import { SearchSelect } from "@/components/search-select";
import { splitEmails, uniqueEmails } from "@/lib/emails";

type ClientOpt = { id: string; companyName: string; mainEmails: string; projects: { id: string; projectName: string; projectEmails: string }[] };

export function NewReviewForm({ clients, team }: { clients: ClientOpt[]; team: { id: string; name: string }[] }) {
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
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
          <label className="label" htmlFor="copyUserId">Ajustes de COPY los atiende</label>
          <select id="copyUserId" name="copyUserId" required className="input" defaultValue="">
            <option value="">Elige a una persona…</option>
            {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="artUserId">Ajustes de ARTE los atiende</label>
          <select id="artUserId" name="artUserId" required className="input" defaultValue="">
            <option value="">Elige a una persona…</option>
            {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
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
