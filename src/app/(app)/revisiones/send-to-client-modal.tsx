"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import { getSendInfo, sendToClient } from "@/app/actions/reviews";
import { Modal } from "@/components/modal";

/**
 * Aviso para devolver los ajustes al cliente: «Enviar al cliente» (cambia la revisión y le llega un correo) y
 * «Enviar por WhatsApp» (solo copia el mensaje para pegarlo en el grupo).
 */
export function SendToClientModal({ reviewId, open, onClose }: { reviewId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [info, setInfo] = useState<{ pending: number; message: string; title: string }>();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<{ warning?: string }>();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInfo(undefined); setError(undefined); setSent(undefined); setCopied(false);
    let alive = true;
    getSendInfo(reviewId).then((r) => { if (!alive) return; if ("error" in r) setError(r.error); else setInfo(r); }).catch(() => alive && setError("No se pudo cargar la información"));
    return () => { alive = false; };
  }, [open, reviewId]);

  async function send() {
    setBusy(true);
    setError(undefined);
    const r = await sendToClient(reviewId);
    setBusy(false);
    if (r.error && !r.ok) return setError(r.error);
    setSent({ warning: r.error });
    router.refresh();
  }

  async function copy() {
    if (!info) return;
    try { await navigator.clipboard.writeText(info.message); } catch {
      const ta = document.createElement("textarea"); ta.value = info.message; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Modal open={open} onClose={onClose} title={sent ? "¡Ajustes enviados al cliente!" : "¡Todos los ajustes están listos!"} subtitle={info?.title}>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!info && !error && <p className="meta">Cargando…</p>}
      {info && !sent && (
        <>
          {info.pending > 0 ? (
            <p className="text-sm">Todavía faltan <strong>{info.pending}</strong> ajuste(s) por marcar como hechos. Cuando estén todos, podrás enviarlos al cliente.</p>
          ) : (
            <p className="text-sm leading-relaxed">Te sugerimos <strong>enviarlos al cliente</strong> para que los revise: le llegará un correo con el enlace. También puedes avisarle por WhatsApp.</p>
          )}
          <p className="rounded-xl bg-black/[0.04] p-3 text-xs leading-relaxed dark:bg-white/[0.06]">{info.message}</p>
        </>
      )}
      {sent && (
        <>
          <p className="text-sm leading-relaxed">La revisión pasó a la siguiente ronda y el cliente ya puede revisar los ajustes{sent.warning ? "." : " (le llegó un correo)."}</p>
          {sent.warning && <p className="text-sm text-destructive">{sent.warning}</p>}
          {info && <p className="rounded-xl bg-black/[0.04] p-3 text-xs leading-relaxed dark:bg-white/[0.06]">{info.message}</p>}
        </>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {info && (
          <button type="button" className="btn-outline" onClick={copy}><MessageCircle size={15} /> {copied ? "✔ Mensaje copiado" : "Enviar por WhatsApp"}</button>
        )}
        {info && !sent && info.pending === 0 && <button type="button" className="btn" disabled={busy} onClick={send}><Send size={15} /> {busy ? "Enviando…" : "Enviar al cliente"}</button>}
        <button type="button" className="btn-outline" onClick={onClose}>{sent ? "Cerrar" : "Todavía no"}</button>
      </div>
    </Modal>
  );
}
