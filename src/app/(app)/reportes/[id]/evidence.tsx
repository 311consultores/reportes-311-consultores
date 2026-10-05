"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";

type Ev = { evidenceUrl: string | null; evidenceType: string | null };

export function Evidence({
  reportId,
  taskId,
  initial,
  editable,
}: {
  reportId: string;
  taskId: string;
  initial: Ev;
  editable: boolean;
}) {
  const [ev, setEv] = useState<Ev>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const endpoint = `/api/reports/${reportId}/tasks/${taskId}/evidence`;

  async function upload(original: File) {
    setError(undefined);
    setBusy(true);
    try {
      let file = original;
      if (original.type.startsWith("image/")) {
        const { default: compress } = await import("browser-image-compression");
        const blob = await compress(original, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: "image/jpeg",
        });
        file = new File([blob], original.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir el archivo");
      setEv(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    setBusy(false);
    if (res.ok) setEv({ evidenceUrl: null, evidenceType: null });
    else setError("No se pudo quitar la evidencia");
  }

  const src = ev.evidenceUrl ? `/api/files/${ev.evidenceUrl}` : null;

  return (
    <div className="space-y-3 border-t border-black/5 px-4 py-3 dark:border-white/10">
      {src && ev.evidenceType === "IMAGE" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Evidencia" className="max-h-64 rounded-xl border border-black/5 dark:border-white/10" />
      )}
      {src && ev.evidenceType === "VIDEO" && <video src={src} controls className="max-h-64 rounded-xl border border-black/5 dark:border-white/10" />}
      {src && ev.evidenceType === "PDF" && (
        <a href={src} target="_blank" className="link text-sm">Ver documento PDF</a>
      )}
      {editable && (
        <div className="flex items-center gap-3">
          <input
            ref={input}
            type="file"
            hidden
            accept="image/jpeg,image/png,application/pdf,video/mp4,video/webm,video/quicktime"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button type="button" className="btn-outline px-3.5 py-1.5 text-xs" disabled={busy} onClick={() => input.current?.click()}>
            <Paperclip size={14} /> {busy ? "Procesando…" : src ? "Reemplazar evidencia" : "Adjuntar evidencia"}
          </button>
          {src && !busy && (
            <button type="button" className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-all duration-200 ease-out hover:text-zinc-900 dark:hover:text-zinc-100" onClick={remove}>
              <X size={13} /> Quitar
            </button>
          )}
          <span className="text-xs text-zinc-500">Imagen, PDF o video</span>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
