"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergeClients } from "@/app/actions/merge-clients";
import { useDialogs } from "@/components/dialogs";
import { Modal } from "@/components/modal";
import { fullName } from "@/lib/client-data";
import { splitEmails, uniqueEmails } from "@/lib/emails";
import type { CardClient } from "./client-card";

type Side = "keep" | "other";
type Row = { key: string; label: string; a: string; b: string; union?: boolean };

const show = (s: string) => s || "—";

function rowsOf(a: CardClient, b: CardClient): Row[] {
  const addr = (c: CardClient) => [c.values.street, c.values.colonia, c.values.postalCode && `C.P. ${c.values.postalCode}`, c.values.city, c.values.state].filter(Boolean).join(", ");
  const fiscal = (c: CardClient) => (c.values.requiresInvoice ? `Requiere factura · ${c.values.legalName || "sin razón social"} · RFC ${c.values.rfc || "—"}${c.hasConstancia ? " · con constancia" : ""}` : "No requiere factura");
  const contact = (n: string, l: string, p: string, e: string) => [fullName(n, l), p, e].filter(Boolean).join(" · ");
  return [
    { key: "name", label: "Nombre de la empresa", a: a.companyName, b: b.companyName },
    { key: "prefix", label: "Prefijo de folio (para reportes nuevos)", a: a.folioPrefix, b: b.folioPrefix },
    { key: "logo", label: "Logo", a: a.logoUrl ? "Con logo" : "Sin logo", b: b.logoUrl ? "Con logo" : "Sin logo" },
    { key: "emails", label: "Correos principales (uno de los dos)", a: a.mainEmails.replaceAll(",", ", "), b: b.mainEmails.replaceAll(",", ", "), union: true },
    { key: "fiscal", label: "Facturación (razón social, RFC y constancia)", a: fiscal(a), b: fiscal(b) },
    { key: "address", label: "Dirección", a: addr(a), b: addr(b) },
    { key: "contact", label: "Contacto principal", a: contact(a.values.contactName, a.values.contactLastName, a.values.contactPhone, a.values.contactEmail), b: contact(b.values.contactName, b.values.contactLastName, b.values.contactPhone, b.values.contactEmail) },
    { key: "billing", label: "Administración y facturación", a: contact(a.values.billingName, a.values.billingLastName, a.values.billingPhone, a.values.billingEmail), b: contact(b.values.billingName, b.values.billingLastName, b.values.billingPhone, b.values.billingEmail) },
  ];
}

/** Fusión de dos clientes: se elige, dato por dato, cuál versión queda como oficial. */
export function MergeClientModal({ open, onClose, client, others }: { open: boolean; onClose: () => void; client: CardClient; others: CardClient[] }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [otherId, setOtherId] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  const other = others.find((o) => o.id === otherId);

  function chooseOther(id: string) {
    setOtherId(id);
    setError(undefined);
    const o = others.find((x) => x.id === id);
    if (!o) return setChoices({});
    // Por defecto: el correo se une; lo demás se queda con este cliente salvo que esté vacío y el otro tenga dato
    const init: Record<string, string> = {};
    for (const r of rowsOf(client, o)) {
      init[r.key] = r.union ? "union" : r.a === "—" || r.a === "" || r.a === "Sin logo" || r.a === "No requiere factura" ? (r.b && r.b !== "Sin logo" && r.b !== "No requiere factura" ? "other" : "keep") : "keep";
    }
    setChoices(init);
  }

  async function submit() {
    if (!other) return;
    const ok = await confirm({
      title: "Fusionar clientes",
      message: `«${other.companyName}» desaparecerá y todos sus proyectos, reportes y facturas pasarán a «${client.companyName}». Los folios ya emitidos no cambian. Esta acción no se puede deshacer.`,
      confirmLabel: "Fusionar",
      danger: true,
    });
    if (!ok) return;
    setError(undefined);
    start(async () => {
      const r = await mergeClients({
        keepId: client.id,
        removeId: other.id,
        choices: choices as Parameters<typeof mergeClients>[0]["choices"],
      });
      if (r.error) setError(r.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  const rows = other ? rowsOf(client, other) : [];
  const unionPreview = other ? uniqueEmails([...splitEmails(client.mainEmails), ...splitEmails(other.mainEmails)]).join(", ") : "";

  return (
    <Modal open={open} onClose={onClose} wide title="Fusionar con otro cliente" subtitle={client.companyName}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor={`merge-${client.id}`}>Cliente con el que se fusiona (desaparecerá y sus datos pasan a este)</label>
          <select id={`merge-${client.id}`} className="input" value={otherId} onChange={(e) => chooseOther(e.target.value)}>
            <option value="">Elige un cliente…</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.companyName} ({o.folioPrefix})</option>)}
          </select>
        </div>

        {other && (
          <>
            <p className="meta">
              Pasarán a «{client.companyName}»: {other.projects.length} proyecto(s) y {other.reportCount} reporte(s) de «{other.companyName}», además de sus facturas y usuarios.
              Elige qué dato queda como oficial:
            </p>
            <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="border-b border-black/5 dark:border-white/10">
                  <tr><th className="th">Dato</th><th className="th">Este cliente</th><th className="th">Cliente a fusionar</th></tr>
                </thead>
                <tbody className="divide-y divide-black/5 align-top dark:divide-white/10">
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td className="td font-medium">{r.label}</td>
                      {(["keep", "other"] as Side[]).map((s) => (
                        <td key={s} className="td">
                          <label className="flex cursor-pointer items-start gap-2">
                            <input type="radio" name={`m-${r.key}`} className="mt-1 accent-[#007AFF]" checked={choices[r.key] === s} onChange={() => setChoices((p) => ({ ...p, [r.key]: s }))} />
                            <span>{show(s === "keep" ? r.a : r.b)}</span>
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="td font-medium">…o unir los correos</td>
                    <td className="td" colSpan={2}>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input type="radio" name="m-emails" className="mt-1 accent-[#007AFF]" checked={choices.emails === "union"} onChange={() => setChoices((p) => ({ ...p, emails: "union" }))} />
                        <span>Unir ambos sin repetir: {unionPreview}</span>
                      </label>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500">Los reportes ya emitidos conservan su folio. Los reportes nuevos usarán el prefijo que elijas arriba.</p>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-danger" disabled={!other || busy} onClick={submit}>{busy ? "Fusionando…" : "Fusionar clientes"}</button>
        </div>
      </div>
    </Modal>
  );
}
