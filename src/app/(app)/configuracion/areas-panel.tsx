"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { createArea, toggleAreaActive, updateArea } from "@/app/actions/areas";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";

export type AreaRow = { id: string; name: string; color: string; active: boolean; tasks: number; people: number };

function ColorInput({ defaultValue }: { defaultValue: string }) {
  return <input name="color" type="color" defaultValue={defaultValue} aria-label="Color del área" className="h-10 w-14 cursor-pointer rounded-lg border border-black/10 bg-transparent p-1 dark:border-white/10" />;
}

function EditArea({ area }: { area: AreaRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}><Pencil size={14} /> Editar</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar área" subtitle={area.name}>
        <ActionForm action={updateArea} submitLabel="Guardar" successMessage="Área actualizada" resetOnSuccess={false} className="space-y-4" onSuccess={() => setTimeout(() => setOpen(false), 700)}>
          <input type="hidden" name="id" value={area.id} />
          <div className="flex items-end gap-3">
            <div className="flex-1"><label className="label">Nombre</label><input name="name" required maxLength={100} defaultValue={area.name} className="input" /></div>
            <div><label className="label">Color</label><ColorInput defaultValue={area.color} /></div>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

/** Catálogo de áreas del equipo (solo Administrador): crear, renombrar, cambiar color y desactivar. */
export function AreasPanel({ areas }: { areas: AreaRow[] }) {
  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Áreas del equipo</h2>
        <p className="meta">Cada tarea pertenece a una sola área y cada persona del TEAM 311 puede estar en varias (se asignan desde Usuarios › Editar). Una área desactivada conserva su historial en el dashboard, pero ya no se ofrece al crear tareas.</p>
      </div>
      <ul className="divide-y divide-black/5 rounded-xl border border-black/5 dark:divide-white/10 dark:border-white/10">
        {areas.map((a) => (
          <li key={a.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${a.active ? "" : "opacity-60"}`}>
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
            <span className="font-medium">{a.name}</span>
            {!a.active && <span className="rounded-full bg-zinc-500/15 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">Desactivada</span>}
            <span className="meta">{a.people} persona(s) · {a.tasks} tarea(s)</span>
            <span className="ml-auto flex items-center gap-2">
              <EditArea area={a} />
              <form action={toggleAreaActive.bind(null, a.id)}><button className="btn-outline">{a.active ? "Desactivar" : "Activar"}</button></form>
            </span>
          </li>
        ))}
        {areas.length === 0 && <li className="px-4 py-3 text-zinc-500">Aún no hay áreas.</li>}
      </ul>
      <ActionForm action={createArea} submitLabel="Agregar área" className="space-y-3" successMessage="Área agregada">
        <div className="flex items-end gap-3">
          <div className="flex-1"><label className="label">Nueva área</label><input name="name" required maxLength={100} placeholder="Nombre del área" className="input" /></div>
          <div><label className="label">Color</label><ColorInput defaultValue="#007AFF" /></div>
        </div>
      </ActionForm>
    </section>
  );
}
