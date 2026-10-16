"use client";

import { useState } from "react";

export type AssignClient = { id: string; name: string; projects: { id: string; name: string }[] };

/** Clientes y proyectos asignados a un TEAM 311: por cliente se marcan todos sus proyectos o solo algunos. */
export function AssignmentsField({ clients, initial = [] }: { clients: AssignClient[]; initial?: string[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set(initial));

  const toggleProject = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleClient = (c: AssignClient, all: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      for (const p of c.projects) { if (all) n.add(p.id); else n.delete(p.id); }
      return n;
    });

  return (
    <div className="space-y-3">
      {[...sel].map((id) => <input key={id} type="hidden" name="projectIds" value={id} />)}
      {clients.length === 0 && <p className="text-sm text-zinc-500">Aún no hay clientes con proyectos.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {clients.map((c) => {
          const chosen = c.projects.filter((p) => sel.has(p.id)).length;
          const all = c.projects.length > 0 && chosen === c.projects.length;
          return (
            <fieldset key={c.id} className="rounded-xl border border-black/5 p-3 dark:border-white/10">
              <legend className="px-1 text-sm font-semibold">{c.name}</legend>
              {c.projects.length === 0 ? (
                <p className="text-xs text-zinc-500">Este cliente aún no tiene proyectos.</p>
              ) : (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="h-4 w-4" checked={all} onChange={(e) => toggleClient(c, e.target.checked)} />
                    Todos los proyectos <span className="text-xs font-normal text-zinc-500">({chosen} de {c.projects.length})</span>
                  </label>
                  {c.projects.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 pl-6 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={sel.has(p.id)} onChange={() => toggleProject(p.id)} />
                      {p.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">Los proyectos que se creen después no se asignan solos: agrégalos aquí cuando corresponda.</p>
    </div>
  );
}
