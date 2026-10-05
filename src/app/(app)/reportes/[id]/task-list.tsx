"use client";

import { useState, useTransition } from "react";
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
  const [pending, start] = useTransition();

  function add() {
    start(async () => {
      const t = await addTask(reportId);
      setTasks((prev) => [...prev, t]);
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Actividades</h2>
        {editable && (
          <button className="btn" onClick={add} disabled={pending}>
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
          onDeleted={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
        />
      ))}
      {tasks.length === 0 && (
        <p className="card meta">Aún no hay actividades registradas.</p>
      )}
    </section>
  );
}
