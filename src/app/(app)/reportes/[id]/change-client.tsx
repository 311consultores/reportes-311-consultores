"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat } from "lucide-react";
import { changeReportClient } from "@/app/actions/reports";
import { EmailPills } from "@/components/email-pills";
import { Modal } from "@/components/modal";

export type ClientOption = { id: string; name: string; prefix: string; projects: { id: string; name: string }[]; mainEmails: string };

const NEW = "__nuevo__";

/** Cambiar el cliente de un reporte (Admin y Editor): regenera el folio con el prefijo del cliente nuevo. */
export function ChangeClientButton({ reportId, folio, status, currentClientId, clients }: {
  reportId: string; folio: string; status: string; currentClientId: string; clients: ClientOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [newName, setNewName] = useState("");
  const [resp, setResp] = useState({ name: "", last: "" });
  const [emails, setEmails] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();

  const options = clients.filter((c) => c.id !== currentClientId);
  const client = options.find((c) => c.id === clientId);
  const sent = status === "ENVIADO";
  const creating = projectId === NEW;

  function close() {
    setOpen(false);
    setError(undefined);
  }

  function submit() {
    setError(undefined);
    start(async () => {
      const r = await changeReportClient({
        reportId,
        clientId,
        ...(creating
          ? { newProject: { name: newName, emails, responsibleName: resp.name, responsibleLastName: resp.last } }
          : { projectId }),
        confirmFolio: typed,
      });
      if (r.error) setError(r.error);
      else {
        close();
        router.refresh();
      }
    });
  }

  const ready = !!client && !!projectId && (!creating || (newName.trim().length >= 2 && resp.name.trim().length >= 2 && resp.last.trim().length >= 2)) && (!sent || typed.trim().length > 0);

  return (
    <>
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}><Repeat size={16} /> Cambiar cliente</button>
      <Modal open={open} onClose={close} wide title="Cambiar el cliente del reporte" subtitle={`Folio actual ${folio}`}>
        <div className="space-y-4">
          <p className="meta">El folio se regenera con el prefijo del cliente nuevo y su siguiente consecutivo. La fecha del folio se conserva y el folio anterior queda en el historial.</p>
          <div>
            <label className="label" htmlFor="chg-client">Cliente nuevo</label>
            <select id="chg-client" className="input" value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(""); setEmails(options.find((c) => c.id === e.target.value)?.mainEmails ?? ""); }}>
              <option value="">Elige un cliente…</option>
              {options.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.prefix})</option>)}
            </select>
          </div>
          {client && (
            <div>
              <label className="label" htmlFor="chg-project">Proyecto del cliente nuevo</label>
              <select id="chg-project" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Elige un proyecto…</option>
                {client.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value={NEW}>+ Crear proyecto nuevo…</option>
              </select>
            </div>
          )}
          {client && creating && (
            <div className="space-y-3 rounded-2xl border border-black/5 p-4 dark:border-white/10">
              <div><label className="label">Nombre del proyecto</label><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label">Responsable: nombre</label><input className="input" value={resp.name} onChange={(e) => setResp((p) => ({ ...p, name: e.target.value }))} /></div>
                <div><label className="label">Apellido</label><input className="input" value={resp.last} onChange={(e) => setResp((p) => ({ ...p, last: e.target.value }))} /></div>
              </div>
              <div>
                <label className="label">Correos del proyecto</label>
                <EmailPills key={clientId} name="newProjectEmails" defaultValue={client.mainEmails} onChange={setEmails} />
              </div>
            </div>
          )}
          {sent && (
            <div className="space-y-2 rounded-2xl bg-[#FF9500]/15 p-4 text-sm text-[#C93400] dark:text-[#FF9F0A]">
              <p><strong>Este reporte ya se envió al cliente.</strong> El folio {folio} ya salió por correo y cambiará. Para confirmar, escribe el folio actual:</p>
              <input className="input uppercase" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={folio} aria-label="Folio actual para confirmar" />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={close}>Cancelar</button>
            <button type="button" className="btn" disabled={!ready || busy} onClick={submit}>{busy ? "Cambiando…" : "Cambiar cliente y regenerar folio"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
