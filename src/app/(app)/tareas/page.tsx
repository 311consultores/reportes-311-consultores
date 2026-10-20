import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { finishedCutoff, mxMonthStart } from "@/lib/tasks-shared";
import { TaskBoard } from "./task-board";
import { taskInclude, toCard } from "@/lib/task-cards";
import type { TaskCard } from "./task-types";

export const metadata = { title: "Tareas | Portal de Operaciones" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ tarea?: string; historial?: string }> }) {
  const user = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const { tarea, historial } = await searchParams;
  const isOps = user.role !== "TEAM_311";
  const history = historial === "1";

  // El TEAM 311 solo ve las tareas que le asignaron; Admin y Editor ven todas
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
    isOps ? prisma.user.findMany({ where: { role: "TEAM_311", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true } }) : Promise.resolve([]),
  ]);

  const tasks: TaskCard[] = rows.map(toCard);

  return (
    <TaskBoard
      tasks={tasks}
      role={user.role}
      meId={user.id}
      openId={tarea}
      history={history}
      initialView={view}
      streak={streak}
      clients={clients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }))}
      team={team}
    />
  );
}
