"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { isEmail, splitEmails, uniqueEmails } from "@/lib/emails";

/**
 * Campo de correos en «pills»: escribe un correo y pulsa Enter (o coma, espacio, Tab) para encapsularlo.
 * Acepta pegar varios correos a la vez. Solo admite correos con formato válido.
 * Envía los correos separados por coma en un campo oculto con el nombre indicado.
 */
export function EmailPills({
  name, defaultValue = "", required, placeholder = "correo@empresa.com",
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [list, setList] = useState<string[]>(() => uniqueEmails(splitEmails(defaultValue)));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();

  /** Convierte el texto escrito en pills; lo que no es un correo válido se queda en el cuadro con un aviso. */
  function commit(text: string) {
    const parts = splitEmails(text);
    if (parts.length === 0) { setDraft(""); setError(undefined); return; }
    const bad = parts.filter((p) => !isEmail(p));
    const good = parts.filter((p) => isEmail(p));
    if (good.length) setList((prev) => uniqueEmails([...prev, ...good]));
    setDraft(bad.join(" "));
    setError(bad.length ? `«${bad[0]}» no es un correo válido` : undefined);
  }

  return (
    <div>
      <div className="input flex min-h-[2.75rem] flex-wrap items-center gap-1.5 !py-1.5">
        {list.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#007AFF]/10 py-0.5 pl-2.5 pr-1 text-sm text-[#007AFF]">
            {e}
            <button type="button" aria-label={`Quitar ${e}`} onClick={() => setList((p) => p.filter((x) => x !== e))} className="rounded-full p-0.5 hover:bg-[#007AFF]/20">
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            // Coma o espacio al final = el correo está completo
            if (/[,;\s]$/.test(v) && v.trim()) commit(v);
            else { setDraft(v); setError(undefined); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "Tab" && draft.trim())) {
              if (e.key === "Enter") e.preventDefault();
              if (draft.trim()) commit(draft);
            } else if (e.key === "Backspace" && !draft && list.length) {
              setList((p) => p.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (/[,;\s]/.test(t.trim())) { e.preventDefault(); commit(`${draft} ${t}`); }
          }}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder={list.length ? "" : placeholder}
          inputMode="email"
          autoComplete="off"
          className="min-w-[10rem] flex-1 border-0 bg-transparent p-1 text-sm outline-none"
        />
      </div>
      <input type="hidden" name={name} value={list.join(",")} />
      {/* Para que el navegador exija al menos un correo cuando el campo es obligatorio */}
      {required && <input tabIndex={-1} aria-hidden className="pointer-events-none absolute h-0 w-0 opacity-0" required value={list.join(",")} onChange={() => {}} />}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : <p className="mt-1 text-xs text-zinc-500">Escribe el correo y pulsa Enter para agregarlo.</p>}
    </div>
  );
}
