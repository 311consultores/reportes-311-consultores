"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { PERIOD_OPTIONS, type Period } from "@/lib/report-period";

/** Selector de periodo de la lista de reportes (conserva el estatus y el orden elegidos). */
export function PeriodFilter({ periodo, desde, hasta }: { periodo: Period; desde: string; hasta: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [from, setFrom] = useState(desde);
  const [to, setTo] = useState(hasta);
  const [custom, setCustom] = useState(periodo === "rango");

  function go(p: Period, d = "", h = "") {
    const q = new URLSearchParams(sp.toString());
    q.set("periodo", p);
    if (p === "rango") {
      if (d) q.set("desde", d); else q.delete("desde");
      if (h) q.set("hasta", h); else q.delete("hasta");
    } else {
      q.delete("desde");
      q.delete("hasta");
    }
    router.push(`${path}?${q.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <select
          aria-label="Periodo"
          className="input w-52 pl-9"
          value={custom ? "rango" : periodo}
          onChange={(e) => {
            const v = e.target.value as Period;
            setCustom(v === "rango");
            if (v !== "rango") go(v);
          }}
        >
          {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {custom && (
        <>
          <DateInput aria-label="Fecha inicial" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-sm text-zinc-500">a</span>
          <DateInput aria-label="Fecha final" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="btn" disabled={!from && !to} onClick={() => go("rango", from, to)}>Aplicar</button>
        </>
      )}
    </div>
  );
}
