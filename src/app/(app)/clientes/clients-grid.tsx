"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ClientCard, type CardClient } from "./client-card";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cards de clientes con buscador (por nombre, prefijo, correos o proyecto). 1 columna en celular, 2 en tableta y 3 en pantalla grande. */
export function ClientsGrid({ clients, isAdmin }: { clients: CardClient[]; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return clients;
    return clients.filter((c) => norm([c.companyName, c.folioPrefix, c.mainEmails, ...c.projects.map((p) => p.projectName)].join(" ")).includes(n));
  }, [clients, q]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input className="input pl-10" placeholder="Buscar cliente, proyecto o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => <ClientCard key={c.id} client={c} isAdmin={isAdmin} />)}
      </div>
      {shown.length === 0 && <p className="card meta">{clients.length === 0 ? "Aún no hay clientes." : "No hay clientes que coincidan con la búsqueda."}</p>}
    </div>
  );
}
