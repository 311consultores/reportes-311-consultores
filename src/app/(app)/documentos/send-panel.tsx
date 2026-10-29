"use client";

import { sendDocument } from "@/app/actions/documents";
import { ActionForm } from "@/components/action-form";

/** Envío por correo: el PDF va adjunto. Solo se habilita al marcar que el documento se leyó y está correcto. */
export function SendPanel({ id, defaults, bcc, resend, mailReady }: {
  id: string; defaults: { to: string; subject: string; body: string }; bcc: string; resend: boolean; mailReady: boolean;
}) {
  const bound = sendDocument.bind(null, id);
  return (
    <ActionForm action={bound} submitLabel={resend ? "Reenviar por correo" : "Enviar por correo"} successMessage="Correo enviado" resetOnSuccess={false} className="space-y-4">
      {!mailReady && <p className="rounded-xl bg-[#FF9500]/12 px-3 py-2 text-xs text-[#B25E00] dark:text-[#FFB340]">El correo (Gmail) no está configurado en este servidor, así que no se puede enviar todavía.</p>}
      <div>
        <label className="label" htmlFor="s-to">Para (separa varios correos con coma)</label>
        <input id="s-to" name="to" className="input" required defaultValue={defaults.to} placeholder="cliente@empresa.com" />
        {bcc && <p className="mt-1 text-xs text-zinc-500">Copia oculta automática: {bcc}</p>}
      </div>
      <div>
        <label className="label" htmlFor="s-subject">Asunto</label>
        <input id="s-subject" name="subject" className="input" required maxLength={255} defaultValue={defaults.subject} />
      </div>
      <div>
        <label className="label" htmlFor="s-body">Mensaje (el PDF va adjunto)</label>
        <textarea id="s-body" name="body" rows={7} className="input" required defaultValue={defaults.body} />
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" name="confirmed" required className="mt-0.5 h-4 w-4 accent-[#007AFF]" />
        <span className="font-medium">Lo leí y está correcto.<span className="block text-xs font-normal text-zinc-500">Revisa la vista previa completa antes de marcarlo: lo que ves ahí es exactamente lo que recibirá el cliente.</span></span>
      </label>
    </ActionForm>
  );
}
