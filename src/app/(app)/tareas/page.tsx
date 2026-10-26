import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ASSIGNABLE_ROLES, isTaskManager, STAFF_ROLES } from "@/lib/roles";
import { requireUser } from "@/lib/auth";
import { finishedCutoff, mxMonthStart } from "@/lib/tasks-shared";
import { publishedWhere } from "@/lib/task-visibility";
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
  const mine: Prisma.TaskWhereInput = isOps ? {} : { AND: [{ assignees: { some: { userId: user.id } } }, publishedWhere()] }; // una tarea programada no aparece hasta su fecha
  const cutoff = finishedCutoff();
  const where: Prisma.TaskWhereInput = history
    ? { ...mine, status: "TERMINADA", OR: [{ hiddenAt: { not: null } }, { acceptedAt: { lt: cutoff } }] }
    : { ...mine, OR: [{ status: { not: "TERMINADA" } }, { hiddenAt: null, acceptedAt: { gte: cutoff } }] };

  const jar = await cookies();
  const view = jar.get("tareas_vista")?.value === "calendario" ? "calendario" : "tablero";
  const calMode = (["hoy", "3d", "7d", "15d", "mes", "lista"] as const).find((m) => m === jar.get("tareas_cal_vista")?.value) ?? "mes";
  const showBirthdays = jar.get("tareas_cumples")?.value !== "0";
  // Racha: tareas aceptadas este mes (solo el TEAM 311 la ve)
  const streak = isOps ? 0 : await prisma.task.count({ where: { ...mine, status: "TERMINADA", acceptedAt: { gte: mxMonthStart() } } });

  const [rows, clients, team, areaRows] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: history ? { acceptedAt: "desc" } : { dueAt: "asc" },
      take: history ? 200 : 500,
      include: taskInclude,
    }),
    isOps ? prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true, projects: { orderBy: { projectName: "asc" }, select: { id: true, projectName: true } } } }) : Promise.resolve([]),
    isOps ? prisma.user.findMany({ where: { role: { in: ASSIGNABLE_ROLES }, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true, role: true } }) : Promise.resolve([]),
    isOps ? prisma.area.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true, active: true } }) : Promise.resolve([]),
  ]);

  const tasks: TaskCard[] = rows.map(toCard);
  // Cumpleaños de todo el equipo interno (el calendario los muestra a todos los roles internos)
  const birthdays = (await prisma.user.findMany({ where: { active: true, birthday: { not: null }, role: { in: ASSIGNABLE_ROLES } }, select: { id: true, name: true, photoUrl: true, birthday: true } }))
    .map((u) => ({ id: u.id, name: u.name, photoUrl: u.photoUrl, md: u.birthday as string }));

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
      calMode={calMode}
      showBirthdays={showBirthdays}
      birthdays={birthdays}
      prefill={prefill}
      notesByTask={notesByTask}
      streak={streak}
      clients={clients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }))}
      team={team}
      areas={areaRows}
    />
  );
}
