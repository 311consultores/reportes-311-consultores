import type { Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/branding";
import { dayKey, mxMonthStart, parseMxInput } from "@/lib/tasks-shared";
import { publishedWhere, startOf } from "@/lib/task-visibility";

/** Dashboard de desempeño: todos los cálculos (solo lectura sobre los datos que el portal ya guarda). */

const H = 3_600_000;
const MIN_ALLOTTED_MS = 60_000; // evita dividir entre cero cuando la fecha límite casi coincide con la creación

export type Thresholds = { green: number; amber: number };
export const DEFAULT_THRESHOLDS: Thresholds = { green: 90, amber: 75 };

export type Light = "green" | "amber" | "red" | "none";
export const lightFor = (pct: number | null, t: Thresholds): Light => (pct === null ? "none" : pct >= t.green ? "green" : pct >= t.amber ? "amber" : "red");

export type Filters = { from: Date; to: Date; personId?: string; clientId?: string; areaId?: string };

export type PeriodKey = "7d" | "30d" | "mes" | "mes-ant" | "custom";

/** Interpreta los parámetros de la dirección; el inicio nunca es anterior a la fecha desde la que se mide. */
export function parsePeriodParams(sp: Record<string, string | undefined>, measuredFrom: Date, now = new Date()): { key: PeriodKey; from: Date; to: Date; desde: string; hasta: string; clamped: boolean } {
  const key = (["7d", "30d", "mes", "mes-ant", "custom"] as const).find((k) => k === sp.periodo) ?? "30d";
  let from: Date;
  let to = now;
  if (key === "7d") from = new Date(now.getTime() - 7 * 24 * H);
  else if (key === "mes") from = mxMonthStart(now);
  else if (key === "mes-ant") {
    to = mxMonthStart(now);
    from = mxMonthStart(new Date(to.getTime() - 24 * H));
  } else if (key === "custom") {
    from = parseMxInput(`${sp.desde ?? ""}T00:00`) ?? new Date(now.getTime() - 30 * 24 * H);
    to = parseMxInput(`${sp.hasta ?? ""}T23:59`) ?? now;
    if (to > now) to = now;
  } else from = new Date(now.getTime() - 30 * 24 * H);
  const clamped = from < measuredFrom;
  if (clamped) from = measuredFrom;
  if (to < from) to = from;
  return { key, from, to, desde: dayKey(from), hasta: dayKey(to), clamped };
}

export async function getMeasuredFrom(): Promise<Date> {
  const v = await getSetting("metrics_start");
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : new Date(); // sin fecha guardada: se mide desde ahora
}

export async function getThresholds(): Promise<Thresholds> {
  const [g, a] = await Promise.all([getSetting("metrics_green"), getSetting("metrics_amber")]);
  const green = Number(g);
  const amber = Number(a);
  return { green: Number.isFinite(green) && g ? green : DEFAULT_THRESHOLDS.green, amber: Number.isFinite(amber) && a ? amber : DEFAULT_THRESHOLDS.amber };
}

// ---------- Cálculo por tarea ----------

type TaskData = Awaited<ReturnType<typeof loadTasks>>[number];

type TaskCalc = {
  id: string;
  deliveredAt: Date | null; // primera vez que se marcó «Lista» (o, si nunca, cuando se aceptó)
  allottedMs: number;
  lateMs: number; // 0 si llegó a tiempo
  score: number | null; // puntualidad proporcional 0-100 (solo si se entregó)
  readyInPeriod: number;
  returnsInPeriod: number;
};

/** Puntualidad proporcional: 100 % si se entregó a tiempo; si no, 100 − (retraso ÷ tiempo que se tenía) × 100, mínimo 0. */
export function punctualityScore(createdAt: Date, dueAt: Date, deliveredAt: Date): { score: number; lateMs: number; allottedMs: number } {
  const allottedMs = Math.max(dueAt.getTime() - createdAt.getTime(), MIN_ALLOTTED_MS);
  const lateMs = Math.max(deliveredAt.getTime() - dueAt.getTime(), 0);
  return { score: lateMs === 0 ? 100 : Math.max(0, 100 - (lateMs / allottedMs) * 100), lateMs, allottedMs };
}

const inRange = (d: Date | null | undefined, f: Filters) => !!d && d >= f.from && d <= f.to;

function calcTask(t: TaskData, f: Filters): TaskCalc {
  const ready = t.events.filter((e) => e.kind === "READY");
  const accepted = t.events.find((e) => e.kind === "ACCEPTED");
  const deliveredAt = ready[0]?.createdAt ?? accepted?.createdAt ?? null;
  const from0 = startOf(t); // desde que la tarea aparece (si se programó)
  const p = deliveredAt ? punctualityScore(from0, t.dueAt, deliveredAt) : null;
  return {
    id: t.id,
    deliveredAt,
    allottedMs: p?.allottedMs ?? Math.max(t.dueAt.getTime() - from0.getTime(), MIN_ALLOTTED_MS),
    lateMs: p?.lateMs ?? 0,
    score: p?.score ?? null,
    readyInPeriod: ready.filter((e) => inRange(e.createdAt, f)).length,
    returnsInPeriod: t.events.filter((e) => e.kind === "RETURNED" && inRange(e.createdAt, f)).length,
  };
}

// ---------- KPIs de un conjunto de tareas ----------

export type Kpis = {
  delivered: number; // tareas entregadas («Lista») en el periodo
  onTime: number;
  punctuality: number | null; // promedio de la calificación proporcional
  lateAvgMs: number | null; // retraso promedio de las tardías
  lateCount: number;
  returnRate: number | null; // devoluciones ÷ entregas del periodo (tope 100)
  returns: number;
  cycleAvgMs: number | null; // creación → aceptación
  responseAvgMs: number | null; // asignación → «En proceso»
  subtaskPct: number | null;
  accepted: number;
  open: number;
  overdue: number;
  soon: number;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeKpis(tasks: TaskData[], f: Filters, now: Date): Kpis {
  const calcs = tasks.map((t) => [t, calcTask(t, f)] as const);
  const deliveredList = calcs.filter(([, c]) => c.deliveredAt && inRange(c.deliveredAt, f));
  const late = deliveredList.filter(([, c]) => c.lateMs > 0);
  const readyEvents = calcs.reduce((n, [, c]) => n + c.readyInPeriod, 0);
  const returns = calcs.reduce((n, [, c]) => n + c.returnsInPeriod, 0);

  const cycle = tasks.filter((t) => inRange(t.acceptedAt, f)).map((t) => t.acceptedAt!.getTime() - startOf(t).getTime());
  const resp: number[] = [];
  for (const t of tasks) {
    if (!inRange(startOf(t), f)) continue;
    const first = t.events.find((e) => (e.kind === "MOVED" && /EN_PROCESO$/.test(e.note ?? "")) || e.kind === "READY");
    if (first) resp.push(first.createdAt.getTime() - startOf(t).getTime());
  }
  let subDone = 0;
  let subAll = 0;
  for (const [t] of deliveredList) {
    subAll += t.subtasks.length;
    subDone += t.subtasks.filter((s) => s.done).length;
  }
  const openTasks = tasks.filter((t) => t.status !== "TERMINADA");
  const active = (s: TaskStatus) => s === "PENDIENTE" || s === "EN_PROCESO";
  return {
    delivered: deliveredList.length,
    onTime: deliveredList.length - late.length,
    punctuality: avg(deliveredList.map(([, c]) => c.score as number)),
    lateAvgMs: avg(late.map(([, c]) => c.lateMs)),
    lateCount: late.length,
    returnRate: readyEvents ? Math.min(100, (returns / readyEvents) * 100) : returns ? 100 : null,
    returns,
    cycleAvgMs: avg(cycle),
    responseAvgMs: avg(resp),
    subtaskPct: subAll ? (subDone / subAll) * 100 : null,
    accepted: cycle.length,
    open: openTasks.length,
    overdue: openTasks.filter((t) => active(t.status) && t.dueAt < now).length,
    soon: openTasks.filter((t) => active(t.status) && t.dueAt >= now && t.dueAt.getTime() - now.getTime() <= 12 * H).length,
  };
}

// ---------- Carga de datos ----------

async function loadTasks(f: Filters) {
  return prisma.task.findMany({
    where: {
      ...(f.clientId ? { clientId: f.clientId } : {}),
      ...(f.areaId ? (f.areaId === "none" ? { areaId: null } : { areaId: f.areaId }) : {}),
      ...(f.personId ? { assignees: { some: { userId: f.personId } } } : {}),
      AND: [publishedWhere(), { OR: [{ createdAt: { gte: f.from, lte: f.to } }, { events: { some: { createdAt: { gte: f.from, lte: f.to } } } }, { status: { not: "TERMINADA" } }] }],
    },
    take: 5000,
    include: {
      events: { orderBy: { createdAt: "asc" }, select: { kind: true, note: true, userId: true, createdAt: true } },
      assignees: { select: { userId: true } },
      subtasks: { select: { done: true } },
      client: { select: { id: true, companyName: true } },
      project: { select: { id: true, projectName: true } },
      area: { select: { id: true, name: true, color: true } },
    },
  });
}

export type PersonRow = { id: string; name: string; role: Role; areas: string[]; kpis: Kpis; streak: number; chat: { messages: number; replyAvgMs: number | null } };
export type MgmtRow = {
  id: string; name: string; role: Role; assigned: number; default48Pct: number | null; editedPct: number | null;
  reviews: number; reviewAvgMs: number | null; returnedByThem: number; returnRate: number | null;
};
export type GroupRow = { id: string; name: string; color?: string; kpis: Kpis; tasks: number };
export type ReportRow = { id: string; name: string; finished: number; sent: number; rejected: number; rejectRate: number | null; editRequests: number; toFinishAvgMs: number | null };

export type Dashboard = {
  filters: Filters;
  team: Kpis;
  people: PersonRow[];
  management: MgmtRow[];
  byClient: GroupRow[];
  byProject: GroupRow[];
  byArea: GroupRow[];
  funnel: { status: TaskStatus; count: number; avgAgeMs: number | null }[];
  loadDist: { id: string; name: string; open: number; overdue: number; soon: number }[];
  assignment: { created: number; edited: number; default48: number };
  reports: { rows: ReportRow[]; finished: number; sent: number; rejected: number; rejectRate: number | null; editRequests: number; toFinishAvgMs: number | null };
  chat: { messages: number; replyAvgMs: number | null };
  taskCount: number;
};

export async function computeDashboard(f: Filters, now = new Date()): Promise<Dashboard> {
  const [tasks, staff, userAreas] = await Promise.all([
    loadTasks(f),
    prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.userArea.findMany({ select: { userId: true, area: { select: { name: true } } } }),
  ]);
  const nameOf = new Map(staff.map((u) => [u.id, u.name]));
  const areasOf = new Map<string, string[]>();
  for (const ua of userAreas) areasOf.set(ua.userId, [...(areasOf.get(ua.userId) ?? []), ua.area.name]);

  const team = computeKpis(tasks, f, now);

  // Por persona (tareas donde está asignada)
  const monthStart = mxMonthStart(now);
  const msgs = await prisma.taskMessage.findMany({
    where: { createdAt: { gte: f.from, lte: f.to }, task: { id: { in: tasks.map((t) => t.id) } } },
    orderBy: [{ taskId: "asc" }, { createdAt: "asc" }],
    select: { taskId: true, userId: true, createdAt: true },
  });
  const chatBy = new Map<string, { messages: number; replies: number[] }>();
  let prev: (typeof msgs)[number] | null = null;
  for (const m of msgs) {
    const c = chatBy.get(m.userId) ?? { messages: 0, replies: [] };
    c.messages++;
    if (prev && prev.taskId === m.taskId && prev.userId !== m.userId) {
      const dt = m.createdAt.getTime() - prev.createdAt.getTime();
      if (dt <= 7 * 24 * H) c.replies.push(dt);
    }
    chatBy.set(m.userId, c);
    prev = m;
  }
  const allReplies = [...chatBy.values()].flatMap((c) => c.replies);

  const people: PersonRow[] = staff
    .filter((u) => !f.personId || u.id === f.personId)
    .map((u) => {
      const mine = tasks.filter((t) => t.assignees.some((a) => a.userId === u.id));
      const c = chatBy.get(u.id);
      return {
        id: u.id, name: u.name, role: u.role, areas: areasOf.get(u.id) ?? [],
        kpis: computeKpis(mine, f, now),
        streak: mine.filter((t) => t.acceptedAt && t.acceptedAt >= monthStart).length,
        chat: { messages: c?.messages ?? 0, replyAvgMs: avg(c?.replies ?? []) },
      };
    });

  // Calidad de la gestión: quien crea y quien revisa
  const createdIn = await prisma.task.findMany({
    where: { createdAt: { gte: f.from, lte: f.to }, ...(f.clientId ? { clientId: f.clientId } : {}), ...(f.areaId ? (f.areaId === "none" ? { areaId: null } : { areaId: f.areaId }) : {}) },
    select: { createdById: true, createdAt: true, dueAt: true, events: { where: { kind: "EDITED" }, select: { id: true }, take: 1 } },
  });
  const mg = new Map<string, { assigned: number; d48: number; edited: number; reviews: number; reviewMs: number[]; returned: number }>();
  const slot = (id: string) => mg.get(id) ?? mg.set(id, { assigned: 0, d48: 0, edited: 0, reviews: 0, reviewMs: [], returned: 0 }).get(id)!;
  for (const t of createdIn) {
    const s = slot(t.createdById);
    s.assigned++;
    const span = t.dueAt.getTime() - t.createdAt.getTime();
    if (span >= 47 * H && span <= 48 * H + 5 * 60_000) s.d48++;
    if (t.events.length) s.edited++;
  }
  for (const t of tasks) {
    let lastReady: Date | null = null;
    for (const e of t.events) {
      if (e.kind === "READY") lastReady = e.createdAt;
      if ((e.kind === "ACCEPTED" || e.kind === "RETURNED") && inRange(e.createdAt, f)) {
        const s = slot(e.userId);
        s.reviews++;
        if (e.kind === "RETURNED") s.returned++;
        if (lastReady) s.reviewMs.push(e.createdAt.getTime() - lastReady.getTime());
      }
    }
  }
  const management: MgmtRow[] = staff
    .filter((u) => u.role !== "TEAM_311" && (!f.personId || u.id === f.personId))
    .map((u) => {
      const s = mg.get(u.id);
      return {
        id: u.id, name: u.name, role: u.role,
        assigned: s?.assigned ?? 0,
        default48Pct: s?.assigned ? (s.d48 / s.assigned) * 100 : null,
        editedPct: s?.assigned ? (s.edited / s.assigned) * 100 : null,
        reviews: s?.reviews ?? 0,
        reviewAvgMs: avg(s?.reviewMs ?? []),
        returnedByThem: s?.returned ?? 0,
        returnRate: s?.reviews ? (s.returned / s.reviews) * 100 : null,
      };
    });

  // Comparativos por cliente, proyecto y área
  const group = (key: (t: TaskData) => { id: string; name: string; color?: string } | null): GroupRow[] => {
    const m = new Map<string, { id: string; name: string; color?: string; list: TaskData[] }>();
    for (const t of tasks) {
      const k = key(t);
      if (!k) continue;
      (m.get(k.id) ?? m.set(k.id, { ...k, list: [] }).get(k.id)!).list.push(t);
    }
    return [...m.values()].map((g) => ({ id: g.id, name: g.name, color: g.color, tasks: g.list.length, kpis: computeKpis(g.list, f, now) })).sort((a, b) => b.tasks - a.tasks);
  };
  const byClient = group((t) => ({ id: t.client.id, name: t.client.companyName }));
  const byProject = group((t) => ({ id: t.project.id, name: `${t.client.companyName} · ${t.project.projectName}` }));
  const byArea = group((t) => (t.area ? { id: t.area.id, name: t.area.name, color: t.area.color } : { id: "none", name: "Sin área", color: "#8E8E93" }));

  // Embudo: tareas abiertas por fase y antigüedad en esa fase
  const phaseKinds = new Set(["CREATED", "MOVED", "READY", "RETURNED", "ACCEPTED"]);
  const funnel = (["PENDIENTE", "EN_PROCESO", "PARA_REVISAR"] as TaskStatus[]).map((status) => {
    const list = tasks.filter((t) => t.status === status);
    const ages = list.map((t) => now.getTime() - (t.events.filter((e) => phaseKinds.has(e.kind)).at(-1)?.createdAt ?? t.createdAt).getTime());
    return { status, count: list.length, avgAgeMs: avg(ages) };
  });
  funnel.push({ status: "TERMINADA", count: tasks.filter((t) => inRange(t.acceptedAt, f)).length, avgAgeMs: null });

  // Distribución de la carga actual
  const loadDist = staff
    .map((u) => {
      const open = tasks.filter((t) => t.status !== "TERMINADA" && t.assignees.some((a) => a.userId === u.id));
      const k = computeKpis(open, f, now);
      return { id: u.id, name: u.name, open: k.open, overdue: k.overdue, soon: k.soon };
    })
    .filter((r) => r.open > 0)
    .sort((a, b) => b.open - a.open);

  const createdN = createdIn.length;
  const assignment = {
    created: createdN,
    edited: createdIn.filter((t) => t.events.length).length,
    default48: createdIn.filter((t) => { const s = t.dueAt.getTime() - t.createdAt.getTime(); return s >= 47 * H && s <= 48 * H + 5 * 60_000; }).length,
  };

  const reports = await computeReports(f);
  return {
    filters: f, team, people, management, byClient, byProject, byArea, funnel, loadDist, assignment, reports,
    chat: { messages: msgs.length, replyAvgMs: avg(allReplies) },
    taskCount: tasks.length,
  };
}

// ---------- Reportes ----------

async function computeReports(f: Filters): Promise<Dashboard["reports"]> {
  const [audits, editReqs] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: f.from, lte: f.to },
        action: { in: ["STATUS_CHANGE_TERMINADO", "STATUS_CHANGE_ENVIADO", "STATUS_CHANGE_RECHAZADO"] },
        ...(f.clientId ? { report: { clientId: f.clientId } } : {}),
      },
      select: { action: true, userId: true, reportId: true, createdAt: true, report: { select: { createdById: true, createdAt: true } } },
    }),
    prisma.editRequest.findMany({ where: { createdAt: { gte: f.from, lte: f.to }, ...(f.clientId ? { report: { clientId: f.clientId } } : {}) }, select: { requestedById: true } }),
  ]);
  const users = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"] } }, select: { id: true, name: true } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  const rows = new Map<string, { finished: Set<string>; sent: Set<string>; rejected: Set<string>; edit: number; toFinish: number[] }>();
  const slot = (id: string) => rows.get(id) ?? rows.set(id, { finished: new Set(), sent: new Set(), rejected: new Set(), edit: 0, toFinish: [] }).get(id)!;
  for (const a of audits) {
    if (!a.reportId) continue;
    if (a.action === "STATUS_CHANGE_TERMINADO") {
      const s = slot(a.userId);
      if (!s.finished.has(a.reportId)) {
        s.finished.add(a.reportId);
        if (a.report) s.toFinish.push(a.createdAt.getTime() - a.report.createdAt.getTime());
      }
    } else if (a.action === "STATUS_CHANGE_ENVIADO") slot(a.userId).sent.add(a.reportId);
    else if (a.report) slot(a.report.createdById).rejected.add(a.reportId); // el rechazo se atribuye a quien hizo el reporte
  }
  for (const r of editReqs) slot(r.requestedById).edit++;
  const list: ReportRow[] = [...rows.entries()]
    .filter(([id]) => !f.personId || id === f.personId)
    .map(([id, s]) => ({
      id, name: name.get(id) ?? "—", finished: s.finished.size, sent: s.sent.size, rejected: s.rejected.size,
      rejectRate: s.finished.size ? Math.min(100, (s.rejected.size / s.finished.size) * 100) : null,
      editRequests: s.edit, toFinishAvgMs: avg(s.toFinish),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const finished = list.reduce((n, r) => n + r.finished, 0);
  const rejected = list.reduce((n, r) => n + r.rejected, 0);
  return {
    rows: list, finished, sent: list.reduce((n, r) => n + r.sent, 0), rejected,
    rejectRate: finished ? Math.min(100, (rejected / finished) * 100) : null,
    editRequests: list.reduce((n, r) => n + r.editRequests, 0),
    toFinishAvgMs: avg(list.flatMap((r) => (r.toFinishAvgMs === null ? [] : [r.toFinishAvgMs]))),
  };
}

// ---------- Filtros desde la dirección ----------

export type Resolved = { period: ReturnType<typeof parsePeriodParams>; filters: Filters; measuredFrom: Date; thresholds: Thresholds; gran: "semana" | "mes" };

/** Lee los filtros (periodo, persona, cliente, área) de la dirección y descarta ids que no existen. Lo comparten el tablero, la ficha y el CSV. */
export async function resolveFilters(sp: Record<string, string | undefined>, opts: { ignorePerson?: boolean } = {}): Promise<Resolved> {
  const [measuredFrom, thresholds] = await Promise.all([getMeasuredFrom(), getThresholds()]);
  const period = parsePeriodParams(sp, measuredFrom);
  const ok = async (id: string | undefined, kind: "user" | "client" | "area") => {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    const found =
      kind === "user" ? await prisma.user.findFirst({ where: { id, role: { in: ["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"] } }, select: { id: true } })
      : kind === "client" ? await prisma.client.findUnique({ where: { id }, select: { id: true } })
      : await prisma.area.findUnique({ where: { id }, select: { id: true } });
    return found ? id : undefined;
  };
  return {
    period, measuredFrom, thresholds,
    gran: sp.gran === "mes" ? "mes" : "semana",
    filters: {
      from: period.from, to: period.to,
      personId: opts.ignorePerson ? undefined : await ok(sp.persona, "user"),
      clientId: await ok(sp.cliente, "client"),
      areaId: sp.area === "none" ? "none" : await ok(sp.area, "area"),
    },
  };
}

// ---------- Tendencia ----------

export type TrendPoint = { label: string; from: Date; to: Date; kpis: Kpis };

const mxDay = (d: Date) => new Date(`${dayKey(d)}T00:00:00-06:00`);

/** Serie por semana (lunes a domingo, hora de México) o por mes para el periodo filtrado (máximo 26 puntos). */
export async function computeTrend(f: Filters, gran: "semana" | "mes", now = new Date()): Promise<TrendPoint[]> {
  const tasks = await loadTasks(f);
  const buckets: { from: Date; to: Date; label: string }[] = [];
  let cursor: Date;
  if (gran === "semana") {
    const day0 = mxDay(f.from);
    const dow = (new Date(day0.getTime() + 12 * H).getUTCDay() + 6) % 7; // 0 = lunes
    cursor = new Date(day0.getTime() - dow * 24 * H);
  } else cursor = mxMonthStart(f.from);
  while (cursor <= f.to && buckets.length < 26) {
    const next = gran === "semana" ? new Date(cursor.getTime() + 7 * 24 * H) : mxMonthStart(new Date(cursor.getTime() + 33 * 24 * H));
    const label = gran === "semana" ? new Date(cursor.getTime() + 12 * H).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }) : new Date(cursor.getTime() + 12 * H).toLocaleDateString("es-MX", { month: "short", year: "2-digit", timeZone: "America/Mexico_City" });
    buckets.push({ from: cursor < f.from ? f.from : cursor, to: new Date(Math.min(next.getTime() - 1, f.to.getTime())), label });
    cursor = next;
  }
  return buckets.map((b) => ({ label: b.label, from: b.from, to: b.to, kpis: computeKpis(tasks, { ...f, from: b.from, to: b.to }, now) }));
}

// ---------- Tareas entregadas (detalle de una ficha) ----------

export type DeliveredRow = { id: string; title: string; client: string; area: string | null; dueAt: Date; deliveredAt: Date; score: number; lateMs: number; returns: number };

export async function deliveredRows(f: Filters): Promise<DeliveredRow[]> {
  const tasks = await loadTasks(f);
  const rows: DeliveredRow[] = [];
  for (const t of tasks) {
    const c = calcTask(t, f);
    if (c.deliveredAt && inRange(c.deliveredAt, f) && c.score !== null) {
      rows.push({ id: t.id, title: t.title, client: t.client.companyName, area: t.area?.name ?? null, dueAt: t.dueAt, deliveredAt: c.deliveredAt, score: c.score, lateMs: c.lateMs, returns: c.returnsInPeriod });
    }
  }
  return rows.sort((a, b) => b.deliveredAt.getTime() - a.deliveredAt.getTime());
}

// ---------- Resumen semanal ----------

/** Lunes 00:00 (hora de México) de la semana en que cae `d`. */
export function mxWeekStart(d: Date): Date {
  const day0 = new Date(`${dayKey(d)}T00:00:00-06:00`);
  const dow = (new Date(day0.getTime() + 12 * H).getUTCDay() + 6) % 7; // 0 = lunes
  return new Date(day0.getTime() - dow * 24 * H);
}

// ---------- Presentación ----------

/** «3 h 20 min», «2 d 4 h», «—». */
export function fmtDur(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${Math.max(m, 0)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export const fmtPct = (p: number | null | undefined) => (p === null || p === undefined ? "—" : `${Math.round(p)} %`);
