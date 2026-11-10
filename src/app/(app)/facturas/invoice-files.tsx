"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import type { InvoiceKind } from "@prisma/client";
import { removeInvoiceFile } from "@/app/actions/invoices";
import { useDialogs } from "@/components/dialogs";
import { MAX_INVOICE_FILE, SLOT_INFO, SLOTS_BY_KIND, type FileSlot } from "@/lib/invoice-files";

/** Sube un archivo a una factura o recibo ya registrado. Devuelve el error, si lo hubo. */
export async function uploadInvoiceFile(invoiceId: string, slot: FileSlot, file: File): Promise<string | null> {
  if (file.size > MAX_INVOICE_FILE) return `«${file.name}» pesa más de 10 MB`;
  try {
    const res = await fetch(`/api/facturas/${invoiceId}/archivos?slot=${slot}`, {
      method: "POST",
      headers: { "content-type": file.type || (slot === "XML" ? "application/xml" : ""), "x-file-name": encodeURIComponent(file.name) },
      body: file,
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? null : j.error ?? "No se pudo subir el archivo";
  } catch {
    return "No se pudo subir el archivo. Revisa tu conexión.";
  }
}

/** Selector de los archivos opcionales al registrar una factura o un recibo (se suben cuando el documento ya quedó registrado). */
export function FilesPicker({ kind, files, onChange }: { kind: InvoiceKind; files: Partial<Record<FileSlot, File>>; onChange: (f: Partial<Record<FileSlot, File>>) => void }) {
  return (
    <div className="space-y-2 rounded-2xl border border-black/5 p-4 dark:border-white/10">
      <p className="text-sm font-medium">Archivos para que el cliente los descargue (opcionales)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SLOTS_BY_KIND[kind].map((slot) => (
          <div key={slot}>
            <label className="label" htmlFor={`file-${slot}`}>{SLOT_INFO[slot].label}</label>
            <input
              id={`file-${slot}`} type="file" accept={SLOT_INFO[slot].accept} className="input !py-1.5 text-sm"
              onChange={(e) => { const f = e.target.files?.[0]; onChange({ ...files, [slot]: f }); }}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">Hasta 10 MB por archivo. No se manda correo al cliente: los archivos quedan disponibles en su panel.</p>
    </div>
  );
}

export type FileRow = { id: string; slot: FileSlot; name: string; size: number };

const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** En el detalle del documento: ver, agregar, reemplazar o quitar los archivos (todo queda en el historial). */
export function FilesPanel({ invoiceId, kind, files }: { invoiceId: string; kind: InvoiceKind; files: FileRow[] }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [busy, setBusy] = useState<FileSlot | null>(null);
  const [error, setError] = useState<string>();

  async function upload(slot: FileSlot, f: File | undefined) {
    if (!f) return;
    setError(undefined);
    setBusy(slot);
    const err = await uploadInvoiceFile(invoiceId, slot, f);
    setBusy(null);
    if (err) setError(err);
    else router.refresh();
  }
  async function remove(file: FileRow) {
    if (!(await confirm({ title: "Quitar archivo", message: `El cliente ya no podrá descargar «${file.name}». Queda registrado en el historial.`, confirmLabel: "Quitar", danger: true }))) return;
    setError(undefined);
    const r = await removeInvoiceFile(file.id);
    if (r.error) setError(r.error);
    else router.refresh();
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Archivos para el cliente</h2>
        <p className="meta text-xs">El cliente los descarga desde su lista de facturas. Al subir uno nuevo en el mismo lugar, el anterior se reemplaza (queda en el historial).</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SLOTS_BY_KIND[kind].map((slot) => {
          const f = files.find((x) => x.slot === slot);
          return (
            <div key={slot} className="space-y-2 rounded-2xl border border-black/5 p-3 dark:border-white/10">
              <p className="text-sm font-medium">{SLOT_INFO[slot].label}</p>
              {f ? (
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={16} className="shrink-0 text-zinc-500" />
                  <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}<span className="ml-1 text-xs text-zinc-500">{kb(f.size)}</span></span>
                  <a href={`/api/facturas/${invoiceId}/archivos/${f.id}`} className="btn-outline px-2.5 py-1.5 text-xs" aria-label={`Descargar ${f.name}`}><Download size={14} /></a>
                  <button type="button" onClick={() => remove(f)} className="rounded-lg p-1.5 text-[#FF3B30] hover:bg-[#FF3B30]/10" aria-label={`Quitar ${f.name}`}><Trash2 size={15} /></button>
                </div>
              ) : <p className="text-sm text-zinc-500">Sin archivo.</p>}
              <label className="btn-outline inline-flex cursor-pointer px-3 py-1.5 text-xs">
                <Upload size={14} /> {busy === slot ? "Subiendo…" : f ? "Reemplazar" : "Subir archivo"}
                <input type="file" className="hidden" accept={SLOT_INFO[slot].accept} disabled={busy !== null} onChange={(e) => { void upload(slot, e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
