import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { finishedCutoff } from "@/lib/tasks-shared";
import { TaskBoard } from "./task-board";
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

  const [rows, clients, team] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: history ? { acceptedAt: "desc" } : { dueAt: "asc" },
      take: history ? 200 : 500,
      include: {
        client: { select: { companyName: true } },
        project: { select: { projectName: true } },
        createdBy: { select: { name: true } },
        assignees: { include: { user: { select: { id: true, name: true, photoUrl: true } } } },
        resources: { orderBy: { position: "asc" } },
        events: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      },
    }),
    isOps ? prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true, projects: { orderBy: { projectName: "asc" }, select: { id: true, projectName: true } } } }) : Promise.resolve([]),
    isOps ? prisma.user.findMany({ where: { role: "TEAM_311", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true } }) : Promise.resolve([]),
  ]);

  const tasks: TaskCard[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    descriptionHtml: t.descriptionHtml,
    dueAt: t.dueAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    status: t.status,
    clientId: t.clientId,
    clientName: t.client.companyName,
    projectId: t.projectId,
    projectName: t.project.projectName,
    createdByName: t.createdBy.name,
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name, photoUrl: a.user.photoUrl })),
    resources: t.resources.map((r) => ({ id: r.id, title: r.title, url: r.url })),
    events: t.events.map((e) => ({ id: e.id, kind: e.kind, note: e.note, userName: e.user.name, createdAt: e.createdAt.toISOString() })),
    acceptedAt: t.acceptedAt?.toISOString() ?? null,
    surprise: t.surprise,
  }));

  return (
    <TaskBoard
      tasks={tasks}
      role={user.role}
      meId={user.id}
      openId={tarea}
      history={history}
      clients={clients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }))}
      team={team}
    />
  );
}
