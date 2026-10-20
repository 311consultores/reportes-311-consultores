"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { setPreference } from "@/lib/client-cookie";
import { UserForm } from "./user-form";
import type { AssignClient } from "./assignments-field";

export type UserRole = "ADMIN" | "EDITOR" | "CLIENTE" | "TEAM_311";
export type UserRow = { id: string; role: UserRole; active: boolean; text: string; node: React.ReactNode };

const TABS: { id: "TODOS" | UserRole; label: string }[] = [
  { id: "TODOS", label: "Todos" },
  { id: "ADMIN", label: "Administradores" },
  { id: "EDITOR", label: "Editores" },
  { id: "TEAM_311", label: "TEAM 311" },
  { id: "CLIENTE", label: "Clientes" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Usuarios agrupados en pestañas por tipo, con buscador, filtro de inactivos y alta de usuario. */
export function UserTabs({ rows, isAdmin, companies, assign, initialTab }: {
  rows: UserRow[]; isAdmin: boolean; companies: { id: string; name: string }[]; assign: AssignClient[]; initialTab: string;
}) {
  const [tab, setTab] = useState<"TODOS" | UserRole>(TABS.some((t) => t.id === initialTab) ? (initialTab as "TODOS" | UserRole) : "TODOS");
  const [q, setQ] = useState("");
  const [inactive, setInactive] = useState(true);

  function pick(t: "TODOS" | UserRole) {
    setTab(t);
    setPreference("usuarios_tab", t); // se recuerda la pestaña elegida
  }

  const nq = norm(q.trim());
  const shown = rows.filter((r) => (tab === "TODOS" || r.role === tab) && (inactive || r.active) && (!nq || norm(r.text).includes(nq)));
  const count = (t: "TODOS" | UserRole) => (t === "TODOS" ? rows.length : rows.filter((r) => r.role === t).length);

  return (
    <div className="space-y-5">
      <details className="card group space-y-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="btn"><Plus size={16} /> Nuevo usuario</span>
        </summary>
        <div className="pt-4">
          {/* La «key» reinicia el formulario con el rol de la pestaña activa */}
          <UserForm key={tab} isAdmin={isAdmin} companies={companies} assign={assign} defaultRole={tab === "TODOS" ? undefined : tab} />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input className="input pl-10" placeholder="Buscar por nombre o correo…" aria-label="Buscar usuarios" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#007AFF]" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>

      <div role="tablist" aria-label="Tipo de usuario" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => pick(t.id)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ease-out", tab === t.id ? "bg-[#007AFF] text-white" : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20")}
          >
            {t.label} ({count(t.id)})
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr><th className="th">Nombre</th><th className="th">Correo</th><th className="th">Rol</th><th className="th">Cumpleaños</th><th className="th">Proyectos</th><th className="th">Estado</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {shown.map((r) => r.node)}
            {shown.length === 0 && <tr><td colSpan={7} className="td py-8 text-center text-zinc-500">No hay usuarios que coincidan</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
