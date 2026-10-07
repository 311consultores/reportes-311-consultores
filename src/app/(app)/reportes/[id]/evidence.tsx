"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { MAX_EVIDENCES } from "@/lib/limits";

export type EvidenceItem = { id: string; url: string; type: string };

export function Evidence({
  reportId,
  taskId,
  initial,
  editable,
}: {
  reportId: string;
  taskId: string;
  initial: EvidenceItem[];
  editable: boolean;
}) {
  const [items, setItems] = useState<EvidenceItem[]>(initial);
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
      setItems((prev) => [...prev, data as EvidenceItem]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    setError(undefined);
    setBusy(true);
    const res = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) setItems((prev) => prev.filter((e) => e.id !== id));
    else setError("No se pudo quitar la evidencia");
  }

  const full = items.length >= MAX_EVIDENCES;

  return (
    <div className="space-y-3 border-t border-black/5 px-4 py-3 dark:border-white/10">
      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-3">
          {items.map((e) => {
            const src = `/api/files/${e.url}`;
            return (
              <li key={e.id} className="group relative overflow-hidden rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.04]">
                {e.type === "IMAGE" && (
                  <a href={src} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="Evidencia" className="h-36 w-full object-cover" />
                  </a>
                )}
                {e.type === "VIDEO" && <video src={src} controls className="h-36 w-full object-cover" />}
                {e.type === "PDF" && (
                  <a href={src} target="_blank" rel="noreferrer" className="link flex h-36 items-center justify-center text-sm">
                    Ver documento PDF
                  </a>
                )}
                {editable && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(e.id)}
                    aria-label="Quitar evidencia"
                    className="glass absolute right-2 top-2 rounded-full p-1.5 text-zinc-700 transition-all duration-200 ease-out hover:scale-105 active:scale-[0.95] dark:text-zinc-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            hidden
            accept="image/jpeg,image/png,application/pdf,video/mp4,video/webm,video/quicktime"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            type="button"
            className="btn-outline px-3.5 py-1.5 text-xs"
            disabled={busy || full}
            onClick={() => input.current?.click()}
          >
            <Paperclip size={14} /> {busy ? "Procesando…" : "Adjuntar evidencia"}
          </button>
          <span className="text-xs text-zinc-500">
            {items.length} de {MAX_EVIDENCES} · imagen, PDF o video
          </span>
        </div>
      )}
      {!editable && items.length === 0 && <p className="text-xs text-zinc-500">Sin evidencias.</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
