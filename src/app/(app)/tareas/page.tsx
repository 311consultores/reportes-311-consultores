import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ASSIGNABLE_ROLES, isTaskManager, STAFF_ROLES } from "@/lib/roles";
import { requireUser } from "@/lib/auth";
import { finishedCutoff, mxMonthStart } from "@/lib/tasks-shared";
import { TaskBoard } from "./task-board";
import { taskInclude, toCard } from "@/lib/task-cards";
import type { TaskCard, TaskPrefill } from "./task-types";

export const metadata = { title: "Tareas | Portal de Operaciones" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ tarea?: string; historial?: string; nota?: string }> }) {
  const user = await requireUser(STAFF_ROLES);
  const { tarea, historial, nota } = await searchParams;
  const isOps = isTaskManager(user.role);
  const history = historial === "1";

  // El TEAM 311 solo ve las tareas que le asignaron; Admin, Editor y PROJECT 311 ven todas
  const mine: Prisma.TaskWhereInput = isOps ? {} : { assignees: { some: { userId: user.id } } };
  const cutoff = finishedCutoff();
  const where: Prisma.TaskWhereInput = history
    ? { ...mine, status: "TERMINADA", OR: [{ hiddenAt: { not: null } }, { acceptedAt: { lt: cutoff } }] }
    : { ...mine, OR: [{ status: { not: "TERMINADA" } }, { hiddenAt: null, acceptedAt: { gte: cutoff } }] };

  const view = (await cookies()).get("tareas_vista")?.value === "calendario" ? "calendario" : "tablero";
  // Racha: tareas aceptadas este mes (solo el TEAM 311 la ve)
  const streak = isOps ? 0 : await prisma.task.count({ where: { ...mine, status: "TERMINADA", acceptedAt: { gte: mxMonthStart() } } });

  const [rows, clients, team] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: history ? { acceptedAt: "desc" } : { dueAt: "asc" },
      take: history ? 200 : 500,
      include: taskInclude,
    }),
    isOps ? prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true, projects: { orderBy: { projectName: "asc" }, select: { id: true, projectName: true } } } }) : Promise.resolve([]),
    isOps ? prisma.user.findMany({ where: { role: { in: ASSIGNABLE_ROLES }, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true, role: true } }) : Promise.resolve([]),
  ]);

  const tasks: TaskCard[] = rows.map(toCard);

  // «Convertir en tarea» desde el Baúl: se precarga el formulario con la nota (solo Admin y Editor; la nota debe ser suya o compartida con la persona)
  let prefill: TaskPrefill | undefined;
  if (nota && isOps && /^[0-9a-f-]{36}$/i.test(nota)) {
    const n = await prisma.note.findFirst({ where: { id: nota, trashedAt: null, OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id } } }] }, include: { items: { orderBy: { position: "asc" } } } });
    if (n) {
      prefill = {
        title: n.title,
        descriptionHtml: n.kind === "CHECKLIST" ? "" : n.bodyHtml,
        clientId: n.clientId ?? "",
        projectId: n.projectId ?? "",
        subtasks: n.kind === "CHECKLIST" ? n.items.map((i) => i.text) : [],
      };
    }
  }

  // Notas del Baúl vinculadas a estas tareas (solo las que esta persona puede ver: suyas o compartidas con ella)
  const linked = await prisma.note.findMany({
    where: { taskId: { in: rows.map((r) => r.id) }, trashedAt: null, OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id } } }] },
    select: { id: true, title: true, taskId: true },
  });
  const notesByTask: Record<string, { id: string; title: string }[]> = {};
  for (const n of linked) (notesByTask[n.taskId as string] ??= []).push({ id: n.id, title: n.title || "Nota sin título" });

  return (
    <TaskBoard
      tasks={tasks}
      role={user.role}
      meId={user.id}
      openId={tarea}
      history={history}
      initialView={view}
      prefill={prefill}
      notesByTask={notesByTask}
      streak={streak}
      clients={clients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }))}
      team={team}
    />
  );
}
