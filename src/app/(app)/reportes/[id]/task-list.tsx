"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addTask, reorderTasks } from "@/app/actions/reports";
import { TaskEditor, type TaskData } from "./task-editor";

export function TaskList({
  reportId,
  initialTasks,
  editable,
  canDelete,
  directDelete,
  isAdmin,
  pendingTaskIds,
}: {
  reportId: string;
  initialTasks: TaskData[];
  editable: boolean;
  canDelete: boolean;
  directDelete: boolean;
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

  // ---- Reordenar: arrastrar con el asa (mouse, dedo o lápiz) o con las flechas ----
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [dragId, setDragId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string>();

  /** Manda el orden actual al servidor; si falla, regresa al orden anterior. */
  async function commit(before: TaskData[]) {
    setMoveError(undefined);
    try {
      const r = await reorderTasks(reportId, tasksRef.current.map((t) => t.id));
      if (r.error) throw new Error(r.error);
    } catch (e) {
      setTasks(before);
      setMoveError(e instanceof Error ? e.message : "No se pudo guardar el nuevo orden");
    }
  }

  function step(id: string, dir: -1 | 1) {
    const before = tasksRef.current;
    const i = before.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= before.length) return;
    const next = [...before];
    [next[i], next[j]] = [next[j], next[i]];
    tasksRef.current = next;
    setTasks(next);
    void commit(before);
  }

  function startDrag(id: string, e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const before = tasksRef.current;
    const prevOpen = openId;
    setDragId(id);
    let y = e.clientY;
    let raf = 0;

    const reposition = () => {
      const list = tasksRef.current;
      const from = list.findIndex((t) => t.id === id);
      let to = list.length - 1;
      for (let k = 0; k < list.length; k++) {
        const el = cards.current.get(list[k].id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y < r.top + r.height / 2) { to = k; break; }
      }
      if (to !== from) {
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        tasksRef.current = next;
        setTasks(next);
      }
    };
    // Desplaza la página cuando el dedo o el mouse se acercan al borde de la pantalla
    const tick = () => {
      if (y < 90) window.scrollBy(0, -14);
      else if (y > window.innerHeight - 90) window.scrollBy(0, 14);
      reposition();
      raf = requestAnimationFrame(tick);
    };
    const move = (ev: PointerEvent) => { y = ev.clientY; reposition(); };
    const end = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setDragId(null);
      setOpenId(prevOpen);
      if (tasksRef.current.some((t, k) => t.id !== before[k]?.id)) void commit(before);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    raf = requestAnimationFrame(tick);
  }

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
      {moveError && <p className="text-sm text-destructive">{moveError}</p>}
      {tasks.map((t, i) => (
        <div
          key={t.id}
          ref={(el) => { if (el) cards.current.set(t.id, el); else cards.current.delete(t.id); }}
          className={dragId === t.id ? "relative z-10 rounded-2xl opacity-90 shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-2 ring-[#007AFF]" : undefined}
        >
          <TaskEditor
            reportId={reportId}
            task={t}
            number={i + 1}
            editable={editable}
            canDelete={canDelete}
            directDelete={directDelete}
            isAdmin={isAdmin}
            deletionPending={pendingTaskIds.includes(t.id)}
            open={dragId ? false : openId === t.id}
            onToggle={() => setOpenId((cur) => (cur === t.id ? null : t.id))}
            onDeleted={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
            reorder={editable && tasks.length > 1 ? {
              onGripDown: (e) => startDrag(t.id, e),
              up: () => step(t.id, -1),
              down: () => step(t.id, 1),
              isFirst: i === 0,
              isLast: i === tasks.length - 1,
            } : undefined}
          />
        </div>
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
