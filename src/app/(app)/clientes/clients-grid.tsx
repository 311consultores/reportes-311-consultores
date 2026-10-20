"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { NewClientForm } from "./new-client-form";
import { ClientCard, type CardClient } from "./client-card";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cards de clientes con buscador (por nombre, prefijo, correos o proyecto). 1 columna en celular, 2 en tableta y 3 en pantalla grande. */
export function ClientsGrid({ clients, isAdmin, readOnly = false, initialQuery = "" }: { clients: CardClient[]; isAdmin: boolean; readOnly?: boolean; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [creating, setCreating] = useState(false);
  const shown = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return clients;
    return clients.filter((c) => norm([c.companyName, c.folioPrefix, c.mainEmails, ...c.projects.map((p) => p.projectName)].join(" ")).includes(n));
  }, [clients, q]);

  return (
    <div className="space-y-4">
      {/* «Nuevo cliente» y el buscador comparten renglón; el formulario de alta se abre debajo */}
      <div className="flex flex-wrap items-center gap-3">
        {!readOnly && <button type="button" className="btn" aria-expanded={creating} onClick={() => setCreating((v) => !v)}><Plus size={16} /> Nuevo cliente</button>}
        <div className="relative w-full max-w-md sm:flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input className="input pl-10" placeholder="Buscar cliente, proyecto o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {creating && !readOnly && (
        <div className="card space-y-4">
          <NewClientForm existing={clients.map((c) => ({ prefix: c.folioPrefix, name: c.companyName }))} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => <ClientCard key={c.id} client={c} isAdmin={isAdmin} readOnly={readOnly} others={clients.filter((o) => o.id !== c.id)} />)}
      </div>
      {shown.length === 0 && <p className="card meta">{clients.length === 0 ? "Aún no hay clientes." : "No hay clientes que coincidan con la búsqueda."}</p>}
    </div>
  );
}
