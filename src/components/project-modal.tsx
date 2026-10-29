"use client";

import { useState, useTransition } from "react";
import { saveProject, type ProjectInfo } from "@/app/actions/admin";
import { EmailPills } from "@/components/email-pills";
import { Modal } from "@/components/modal";

/**
 * Crear o editar un proyecto sin salir de la pantalla. Sin `project` crea uno nuevo (los correos del cliente vienen sugeridos);
 * con `project` edita su nombre, responsable y correos.
 */
export function ProjectModal({ open, onClose, client, project, onSaved }: {
  open: boolean;
  onClose: () => void;
  client: { id: string; companyName: string; mainEmails: string };
  project?: ProjectInfo;
  onSaved: (p: ProjectInfo) => void;
}) {
  const [name, setName] = useState(project?.projectName ?? "");
  const [resp, setResp] = useState({ name: project?.responsibleName ?? "", last: project?.responsibleLastName ?? "" });
  const [emails, setEmails] = useState(project ? project.projectEmails : client.mainEmails);
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();

  function submit() {
    setError(undefined);
    start(async () => {
      const r = await saveProject({
        id: project?.id, clientId: client.id, projectName: name, projectEmails: emails,
        responsibleName: resp.name, responsibleLastName: resp.last,
      });
      if (r.error || !r.project) return setError(r.error ?? "No se pudo guardar el proyecto");
      onSaved(r.project);
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={project ? "Editar proyecto" : "Crear proyecto"} subtitle={client.companyName}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="prj-name">Nombre del proyecto</label>
          <input id="prj-name" className="input" required maxLength={191} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="prj-resp">Responsable: nombre (opcional)</label>
            <input id="prj-resp" className="input" maxLength={120} value={resp.name} onChange={(e) => setResp((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="prj-last">Apellido (opcional)</label>
            <input id="prj-last" className="input" maxLength={120} value={resp.last} onChange={(e) => setResp((s) => ({ ...s, last: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">Correos del proyecto</label>
          <EmailPills name="projectEmails" defaultValue={emails} onChange={setEmails} />
          {!project && <p className="mt-1 text-xs text-zinc-500">Se sugieren los correos del cliente; puedes quitarlos o agregar otros. Si coinciden, el reporte se envía una sola vez.</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn" disabled={busy || name.trim().length < 2} onClick={submit}>{busy ? "Guardando…" : project ? "Guardar cambios" : "Crear proyecto"}</button>
        </div>
      </div>
    </Modal>
  );
}
