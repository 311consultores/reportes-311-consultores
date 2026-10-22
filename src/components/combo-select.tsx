"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboOption = { id: string; label: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Lista desplegable con buscador de texto predictivo (reemplaza a un <select> largo).
 * Con «allLabel» incluye la opción de quitar el filtro (valor vacío). Con «name» envía el valor en un formulario.
 */
export function ComboSelect({ options, value, onChange, placeholder = "Escribe para buscar…", name, required, disabled, ariaLabel, allLabel, className }: {
  options: ComboOption[]; value: string; onChange: (id: string) => void; placeholder?: string; name?: string; required?: boolean; disabled?: boolean; ariaLabel?: string; allLabel?: string; className?: string;
}) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.id === value);

  const list = useMemo(() => {
    const n = norm(q.trim());
    const found = options.filter((o) => !n || norm(o.label).includes(n));
    return allLabel && !n ? [{ id: "", label: allLabel }, ...found] : found;
  }, [options, q, allLabel]);

  // Si es obligatorio y no se eligió nada, el navegador avisa al enviar el formulario
  useEffect(() => {
    input.current?.setCustomValidity(required && !value ? "Elige una opción de la lista" : "");
  }, [required, value]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQ("");
  }

  return (
    <div
      ref={box}
      className={cn("relative", className)}
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node)) { setOpen(false); setQ(""); }
      }}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <input
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        autoComplete="off"
        className="input pr-14"
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? q : selected?.label ?? ""}
        required={required}
        onFocus={() => { setOpen(true); setActive(0); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, list.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open && list[active]) { e.preventDefault(); pick(list[active].id); }
          else if (e.key === "Escape") { setOpen(false); setQ(""); }
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-zinc-500">
        {value && !required && !disabled && (
          <button type="button" aria-label="Quitar selección" className="pointer-events-auto rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10" onMouseDown={(e) => e.preventDefault()} onClick={() => pick("")}>
            <X size={14} />
          </button>
        )}
        <ChevronDown size={16} />
      </span>
      {open && !disabled && (
        <ul id={`${uid}-list`} role="listbox" className="glass absolute z-30 mt-1 max-h-60 w-full min-w-[12rem] overflow-auto rounded-xl py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          {list.length === 0 && <li className="px-3.5 py-2 text-sm text-zinc-500">Sin resultados</li>}
          {list.map((o, i) => (
            <li key={o.id || "all"} role="option" aria-selected={o.id === value}>
              <button
                type="button"
                className={cn("flex w-full items-center px-3.5 py-2 text-left text-sm hover:bg-[#007AFF]/10", i === active && "bg-[#007AFF]/10", o.id === value && "font-semibold")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.id)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
