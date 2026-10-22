"use server";

import type { Prisma } from "@prisma/client";
import { STAFF_ROLES } from "@/lib/roles";
import { publishedWhere } from "@/lib/task-visibility";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { htmlToText } from "@/lib/sanitize";
import { finishedCutoff } from "@/lib/tasks-shared";
import { taskInclude, toCard } from "@/lib/task-cards";
import type { TaskCard } from "@/app/(app)/tareas/task-types";

export type TaskHit = { id: string; title: string; clientName: string; projectName: string; status: TaskCard["status"]; history: boolean; field: string; snippet: string | null };

/** Tareas que puede ver esta persona: Admin y Editor todas; el TEAM 311 solo las suyas. */
const scopeFor = (u: CurrentUser): Prisma.TaskWhereInput => (u.role === "TEAM_311" ? { AND: [{ assignees: { some: { userId: u.id } } }, publishedWhere()] } : {});

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Un fragmento del texto alrededor de la coincidencia. */
function around(text: string, q: string): string | null {
  const i = norm(text).indexOf(norm(q));
  if (i < 0) return null;
  const start = Math.max(0, i - 30);
  return (start > 0 ? "…" : "") + text.slice(start, i + q.length + 50) + (i + q.length + 50 < text.length ? "…" : "");
}

/**
 * Búsqueda predictiva de tareas: nombre, descripción, cliente, proyecto, personas, recursos y comentarios del chat.
 * Incluye las terminadas ocultas y el historial. Devuelve hasta 10 sugerencias.
 */
export async function searchTasks(query: string): Promise<TaskHit[]> {
  const user = await requireUser(STAFF_ROLES);
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const rows = await prisma.task.findMany({
    where: {
      ...scopeFor(user),
      OR: [
        { title: { contains: q } },
        { descriptionHtml: { contains: q } },
        { client: { companyName: { contains: q } } },
        { project: { projectName: { contains: q } } },
        { assignees: { some: { user: { name: { contains: q } } } } },
        { resources: { some: { title: { contains: q } } } },
        { messages: { some: { bodyHtml: { contains: q } } } },
        { subtasks: { some: { title: { contains: q } } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    include: {
      client: { select: { companyName: true } },
      project: { select: { projectName: true } },
      assignees: { select: { user: { select: { name: true } } } },
      resources: { select: { title: true } },
      messages: { where: { bodyHtml: { contains: q } }, take: 1, select: { bodyHtml: true } },
      subtasks: { where: { title: { contains: q } }, take: 1, select: { title: true } },
    },
  });

  const cutoff = finishedCutoff();
  const nq = norm(q);
  const has = (s: string) => norm(s).includes(nq);
  const hits = rows.map((t) => {
    let field = "Chat";
    let snippet: string | null = null;
    let rank = 6;
    const desc = htmlToText(t.descriptionHtml);
    const person = t.assignees.find((a) => has(a.user.name));
    const res = t.resources.find((r) => has(r.title));
    if (has(t.title)) { field = "Nombre"; rank = 0; }
    else if (has(t.client.companyName)) { field = "Cliente"; rank = 1; snippet = t.client.companyName; }
    else if (has(t.project.projectName)) { field = "Proyecto"; rank = 2; snippet = t.project.projectName; }
    else if (person) { field = "Persona"; rank = 3; snippet = person.user.name; }
    else if (has(desc)) { field = "Descripción"; rank = 4; snippet = around(desc, q); }
    else if (res) { field = "Recurso"; rank = 5; snippet = res.title; }
    else if (t.subtasks[0]) { field = "Subtarea"; rank = 5; snippet = t.subtasks[0].title; }
    else if (t.messages[0]) { snippet = around(htmlToText(t.messages[0].bodyHtml), q); }
    return {
      rank,
      hit: {
        id: t.id, title: t.title, clientName: t.client.companyName, projectName: t.project.projectName, status: t.status,
        history: t.status === "TERMINADA" && (!!t.hiddenAt || (!!t.acceptedAt && t.acceptedAt < cutoff)), field, snippet,
      } satisfies TaskHit,
    };
  });
  return hits.sort((a, b) => a.rank - b.rank).slice(0, 10).map((h) => h.hit);
}

/** Una tarea completa (para abrir su detalle desde la búsqueda, aunque esté en el historial). */
export async function getTaskCard(id: string): Promise<TaskCard | null> {
  const user = await requireUser(STAFF_ROLES);
  const t = await prisma.task.findFirst({ where: { id, ...scopeFor(user) }, include: taskInclude });
  return t ? toCard(t) : null;
}
