"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addTask } from "@/app/actions/reports";
import { TaskEditor, type TaskData } from "./task-editor";

export function TaskList({
  reportId,
  initialTasks,
  editable,
  canDelete,
  isAdmin,
  pendingTaskIds,
}: {
  reportId: string;
  initialTasks: TaskData[];
  editable: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  pendingTaskIds: string[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  // Acordeón: al abrir un reporte solo la última actividad está desplegada
  const [openId, setOpenId] = useState<string | null>(initialTasks.at(-1)?.id ?? null);
  const [pending, start] = useTransition();
  const addBtn = useRef<HTMLButtonElement>(null);
  const [headerVisible, setHeaderVisible] = useState(true);

  // Cuando el botón superior sale de la pantalla, aparece uno flotante que acompaña al usuario
  useEffect(() => {
    const el = addBtn.current;
    if (!el) return;
    const check = () => setHeaderVisible(el.getBoundingClientRect().bottom > 0);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [editable]);

  function add() {
    start(async () => {
      const t = await addTask(reportId);
      setTasks((prev) => [...prev, t]);
      setOpenId(t.id); // la nueva queda abierta y las demás se contraen
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Actividades</h2>
        {editable && (
          <button ref={addBtn} className="btn" onClick={add} disabled={pending}>
            <Plus size={16} /> Agregar actividad
          </button>
        )}
      </div>
      {tasks.map((t, i) => (
        <TaskEditor
          key={t.id}
          reportId={reportId}
          task={t}
          number={i + 1}
          editable={editable}
          canDelete={canDelete}
          isAdmin={isAdmin}
          deletionPending={pendingTaskIds.includes(t.id)}
          open={openId === t.id}
          onToggle={() => setOpenId((cur) => (cur === t.id ? null : t.id))}
          onDeleted={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
        />
      ))}
      {tasks.length === 0 && (
        <p className="card meta">Aún no hay actividades registradas.</p>
      )}

      {editable && !headerVisible && (
        <button
          className="btn fixed bottom-6 right-6 z-40 rounded-full px-5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.25)]"
          onClick={add}
          disabled={pending}
        >
          <Plus size={18} /> Agregar actividad
        </button>
      )}
    </section>
  );
}
