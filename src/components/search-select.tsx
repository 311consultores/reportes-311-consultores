"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Selector con búsqueda dinámica: se filtra al escribir. Envía el valor elegido en un campo oculto. */
export function SearchSelect({
  name,
  options,
  value,
  onChange,
  placeholder = "Buscar…",
  required,
}: {
  name: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return q ? options.filter((o) => norm(o.label).includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(o: Option) {
    onChange(o.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <div className="relative">
        <input
          className="input pr-9"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : (selected?.label ?? "")}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (filtered[active]) pick(filtered[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          autoComplete="off"
        />
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="glass absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          {filtered.length === 0 && <li className="px-3.5 py-2 text-sm text-zinc-500">Sin resultados</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer px-3.5 py-2 text-sm",
                i === active && "bg-[#007AFF]/10 text-[#007AFF]",
                o.value === value && "font-medium",
              )}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
