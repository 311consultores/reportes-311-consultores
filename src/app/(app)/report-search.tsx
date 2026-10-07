"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Hit = { id: string; folio: string; client: string; project: string; match: string | null };

/** Búsqueda de reportes con resultados preliminares: folio, cliente, proyecto y actividades. */
export function ReportSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(""); // texto de la última búsqueda terminada
  const box = useRef<HTMLDivElement>(null);
  const query = q.trim();
  const ready = query.length >= 2;
  const loading = ready && done !== query;
  const shown = ready ? hits : [];

  useEffect(() => {
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        setHits(res.ok ? await res.json() : []);
        setActive(0);
        setDone(query);
      } catch {
        /* petición cancelada */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (h: Hit) => {
    setOpen(false);
    router.push(`/reportes/${h.id}`);
  };

  return (
    <div ref={box} className="relative w-72">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input
        className="input pl-10"
        placeholder="Buscar cliente, proyecto o contenido…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && shown[active]) {
            e.preventDefault();
            go(shown[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && ready && (
        <div className="glass absolute right-0 z-30 mt-1 w-[26rem] max-w-[90vw] overflow-hidden rounded-2xl py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          {loading && <p className="px-4 py-3 text-sm text-zinc-500">Buscando…</p>}
          {!loading && shown.length === 0 && <p className="px-4 py-3 text-sm text-zinc-500">Sin resultados</p>}
          {!loading && shown.map((h, i) => (
            <button
              key={h.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(h);
              }}
              className={cn("block w-full px-4 py-2.5 text-left transition-colors duration-150", i === active && "bg-[#007AFF]/10")}
            >
              <span className="block text-sm font-medium text-[#007AFF]">{h.folio}</span>
              <span className="block text-sm">{h.client} · {h.project}</span>
              {h.match && <span className="block truncate text-xs text-zinc-500">{h.match}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
