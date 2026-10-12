"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copia un texto al portapapeles y muestra «Copiado» un momento. */
export function CopyButton({ text, label = "Copiar", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Respaldo para navegadores o conexiones que no permiten el portapapeles
      const t = document.createElement("textarea");
      t.value = text;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label}: ${text}`}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#007AFF] transition-all duration-200 ease-out hover:bg-[#007AFF]/10 active:scale-[0.95] ${className}`}
    >
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? "Copiado" : label}
    </button>
  );
}
