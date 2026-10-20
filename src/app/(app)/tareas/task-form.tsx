"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createTask, updateTask } from "@/app/actions/tasks";
import { ConsultantPicker, type TeamOption } from "@/components/consultant-picker";
import { RichTextEditor } from "@/components/rich-text";
import { defaultDue, toMxInput } from "@/lib/tasks-shared";
import type { TaskCard } from "./task-types";

export type ClientOption = { id: string; name: string; projects: { id: string; name: string }[] };

/** Formulario para crear o editar una tarea (Admin y Editor). */
export function TaskForm({ clients, team, task, onDone, onCancel }: {
  clients: ClientOption[]; team: TeamOption[]; task?: TaskCard; onDone: (taskId: string) => void; onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(task?.clientId ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? "");
  const [dueAt, setDueAt] = useState(() => toMxInput(task ? new Date(task.dueAt) : defaultDue()));
  const [resources, setResources] = useState<{ key: number; title: string; url: string }[]>(() =>
    task?.resources.length ? task.resources.map((r, i) => ({ key: i, title: r.title, url: r.url })) : [],
  );
  const [nextKey, setNextKey] = useState(100);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees.map((a) => a.id) ?? []);
  const [subs, setSubs] = useState<{ key: number; id: string; title: string; who: string; due: string }[]>(() =>
    (task?.subtasks ?? []).map((s, i) => ({ key: 1000 + i, id: s.id, title: s.title, who: s.assigneeId ?? "", due: s.dueAt ? toMxInput(new Date(s.dueAt)) : "" })),
  );
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  const projects = clients.find((c) => c.id === clientId)?.projects ?? [];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(undefined);
    start(async () => {
      const r = task ? await updateTask(task.id, fd) : await createTask(fd);
      if (r.error || !r.taskId) setError(r.error ?? "No se pudo guardar");
      else onDone(r.taskId);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-client">Cliente</label>
          <select id="t-client" name="clientId" className="input" value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(""); }} required>
            <option value="">Elige un cliente…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-project">Proyecto</label>
          <select id="t-project" name="projectId" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required disabled={!clientId}>
            <option value="">{clientId ? "Elige un proyecto…" : "Primero elige el cliente"}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Asignar a (TEAM 311)</label>
        <ConsultantPicker options={team} initial={task?.assignees.map((a) => a.id) ?? []} onChange={setAssigneeIds} />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div>
          <label className="label" htmlFor="t-title">Tarea</label>
          <input id="t-title" name="title" className="input" maxLength={191} defaultValue={task?.title ?? ""} placeholder="Nombre de la tarea" required />
        </div>
        <div>
          <label className="label" htmlFor="t-due">Fecha y hora de entrega</label>
          <input id="t-due" name="dueAt" type="datetime-local" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
          {!task && <p className="mt-1 text-xs text-zinc-500">Por defecto, 48 horas después de crearla.</p>}
        </div>
      </div>

      <div>
        <label className="label">Descripción (opcional)</label>
        <RichTextEditor name="descriptionHtml" initialHtml={task?.descriptionHtml ?? ""} />
      </div>

      <div className="space-y-2">
        <label className="label">Subtareas (opcional)</label>
        {subs.map((s) => (
          <div key={s.key} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl bg-black/[0.03] p-2 dark:bg-white/[0.04] md:grid-cols-[2fr_1.2fr_1.4fr_auto]">
            <input type="hidden" name="subId" value={s.id} />
            <input name="subTitle" className="input" placeholder="Nombre de la subtarea" maxLength={191} value={s.title} onChange={(e) => setSubs((p) => p.map((x) => (x.key === s.key ? { ...x, title: e.target.value } : x)))} />
            <select name="subAssignee" className="input" aria-label="Persona responsable" value={assigneeIds.includes(s.who) ? s.who : ""} onChange={(e) => setSubs((p) => p.map((x) => (x.key === s.key ? { ...x, who: e.target.value } : x)))}>
              <option value="">Sin responsable</option>
              {team.filter((t) => assigneeIds.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input name="subDue" type="datetime-local" className="input" aria-label="Fecha de entrega de la subtarea" value={s.due} onChange={(e) => setSubs((p) => p.map((x) => (x.key === s.key ? { ...x, due: e.target.value } : x)))} />
            <button type="button" aria-label="Quitar subtarea" onClick={() => setSubs((p) => p.filter((x) => x.key !== s.key))} className="rounded-full p-1.5 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><X size={16} /></button>
          </div>
        ))}
        <button type="button" className="btn-outline" onClick={() => { setSubs((p) => [...p, { key: nextKey, id: "", title: "", who: "", due: "" }]); setNextKey((k) => k + 1); }}>
          <Plus size={15} /> Agregar subtarea
        </button>
      </div>

      <div className="space-y-2">
        <label className="label">Recursos (links de Drive u otros, opcional)</label>
        {resources.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_1.6fr_auto] items-center gap-2">
            <input name="resourceTitle" className="input" placeholder="Título (ej. Carpeta del cliente)" maxLength={191} value={r.title} onChange={(e) => setResources((p) => p.map((x) => (x.key === r.key ? { ...x, title: e.target.value } : x)))} />
            <input name="resourceUrl" className="input" type="url" placeholder="https://drive.google.com/…" value={r.url} onChange={(e) => setResources((p) => p.map((x) => (x.key === r.key ? { ...x, url: e.target.value } : x)))} />
            <button type="button" aria-label="Quitar recurso" onClick={() => setResources((p) => p.filter((x) => x.key !== r.key))} className="rounded-full p-1.5 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><X size={16} /></button>
          </div>
        ))}
        <button type="button" className="btn-outline" onClick={() => { setResources((p) => [...p, { key: nextKey, title: "", url: "" }]); setNextKey((k) => k + 1); }}>
          <Plus size={15} /> Agregar recurso
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn" disabled={busy}>{busy ? "Guardando…" : task ? "Guardar cambios" : "Asignar tarea"}</button>
      </div>
    </form>
  );
}
