"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarChip } from "@/components/avatar";

export type TeamOption = { id: string; name: string; photoUrl: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Selector múltiple con buscador de usuarios TEAM 311: los elegidos aparecen como fotos con su nombre. */
export function ConsultantPicker({ options, initial = [] }: { options: TeamOption[]; initial?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const available = useMemo(() => {
    const n = norm(q.trim());
    return options.filter((o) => !selected.includes(o.id) && (!n || norm(o.name).includes(n)));
  }, [options, selected, q]);

  return (
    <div ref={box} className="relative space-y-2" onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      {selected.map((id) => <input key={id} type="hidden" name="consultantIds" value={id} />)}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const o = options.find((x) => x.id === id);
            if (!o) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1">
                <AvatarChip name={o.name} userId={o.id} photoKey={o.photoUrl} />
                <button type="button" aria-label={`Quitar a ${o.name}`} onClick={() => setSelected((s) => s.filter((x) => x !== id))} className="rounded-full p-1 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10">
                  <X size={14} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <input
        className="input"
        placeholder={options.length === 0 ? "Aún no hay usuarios TEAM 311" : "Escribe para buscar y agregar consultores…"}
        value={q}
        disabled={options.length === 0}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        autoComplete="off"
      />
      {open && (
        <ul className="glass absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          {available.length === 0 && <li className="px-3.5 py-2 text-sm text-zinc-500">{options.length === selected.length ? "Ya agregaste a todos" : "Sin resultados"}</li>}
          {available.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-[#007AFF]/10"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setSelected((s) => [...s, o.id]); setQ(""); }}
              >
                <Avatar name={o.name} userId={o.id} photoKey={o.photoUrl} size={26} /> {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">Solo aparecen usuarios con rol TEAM 311.</p>
    </div>
  );
}
