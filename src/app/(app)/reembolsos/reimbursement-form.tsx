"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/date-input";
import { URGENCIES } from "@/lib/reimbursements";
import { MAX_RECEIPT } from "@/lib/reimbursements";

type ClientOpt = { id: string; name: string; projects: { id: string; name: string }[] };

/** Solicitud de reembolso del TEAM 311: concepto, monto, fecha, urgencia, comprobante opcional y cliente/proyecto opcionales. */
export function ReimbursementForm({ today, clients }: { today: string; clients: ClientOpt[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const projects = clients.find((c) => c.id === clientId)?.projects ?? [];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("receipt");
    setError(undefined);
    setDone(false);
    // El comprobante es opcional; si se adjunta, no debe pesar más de 10 MB
    if (file instanceof File && file.size > MAX_RECEIPT) return setError("El comprobante pesa más de 10 MB");
    setBusy(true);
    try {
      const res = await fetch("/api/reembolsos", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(j.error ?? "No se pudo enviar la solicitud");
      else {
        setDone(true);
        setClientId("");
        setFormKey((k) => k + 1);
        router.refresh();
      }
    } catch {
      setError("No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.");
    }
    setBusy(false);
  }

  return (
    <form key={formKey} onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_10rem_11rem]">
        <div>
          <label className="label" htmlFor="r-concept">Concepto</label>
          <input id="r-concept" name="concept" className="input" maxLength={200} placeholder="Ej. Impresiones para la junta" required />
        </div>
        <div>
          <label className="label" htmlFor="r-amount">Monto</label>
          <input id="r-amount" name="amount" className="input" inputMode="decimal" placeholder="350.00" required />
        </div>
        <div>
          <label className="label" htmlFor="r-date">Fecha del gasto</label>
          <DateInput id="r-date" name="spentOn" max={today} defaultValue={today} required />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="r-urgency">¿Cuándo necesitas que se te devuelva?</label>
          <select id="r-urgency" name="urgency" className="input" defaultValue="" required>
            <option value="" disabled>Elige…</option>
            {URGENCIES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-client">Cliente (opcional)</label>
          <select id="r-client" name="clientId" className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Ninguno</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-project">Proyecto (opcional)</label>
          <select id="r-project" name="projectId" className="input" disabled={!clientId}>
            <option value="">Ninguno</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="r-file">Comprobante (foto del ticket o PDF) — opcional</label>
        <input id="r-file" name="receipt" type="file" accept="image/jpeg,image/png,application/pdf" className="input !py-1.5 text-sm" />
        <p className="mt-1 text-xs text-zinc-500">JPG, PNG o PDF de hasta 10 MB. Si no tienes comprobante, puedes enviar la solicitud sin él: el Administrador verá que va sin comprobante.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {done && <p role="status" className="text-sm text-[#248A3D]">✔ Solicitud enviada. Se avisó al Administrador.</p>}
      <button type="submit" className="btn" disabled={busy}>{busy ? "Enviando…" : "Solicitar reembolso"}</button>
    </form>
  );
}
