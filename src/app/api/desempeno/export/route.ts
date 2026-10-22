import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { computeDashboard, computeTrend, fmtDur, resolveFilters, type GroupRow, type Kpis } from "@/lib/metrics";
import { dayKey } from "@/lib/tasks-shared";

export const runtime = "nodejs";

/** Evita que Excel interprete como fórmula un texto que empieza con = + - @. */
const cell = (v: string | number | null | undefined) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const pct = (p: number | null) => (p === null ? "" : Math.round(p * 10) / 10);
const hrs = (ms: number | null) => (ms === null ? "" : Math.round((ms / 3_600_000) * 100) / 100); // horas con 2 decimales

const KPI_HEAD = ["Entregadas", "A tiempo", "Puntualidad %", "Tardías", "Retraso prom. (h)", "Devoluciones", "Tasa de devolución %", "Ciclo prom. (h)", "Respuesta prom. (h)", "Subtareas %", "Abiertas", "Vencidas", "Por vencer 12 h"];
const kpiCells = (k: Kpis) => [k.delivered, k.onTime, pct(k.punctuality), k.lateCount, hrs(k.lateAvgMs), k.returns, pct(k.returnRate), hrs(k.cycleAvgMs), hrs(k.responseAvgMs), pct(k.subtaskPct), k.open, k.overdue, k.soon];
const groupRows = (rows: GroupRow[]) => rows.map((g) => [g.name, g.tasks, ...kpiCells(g.kpis)]);

/** Exporta a CSV (se abre en Excel) la tabla elegida del dashboard con los mismos filtros de la pantalla. Solo Administrador. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 403 });

  const sp = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string | undefined>;
  const r = await resolveFilters(sp);
  const tipo = ["personas", "areas", "clientes", "proyectos", "gestion", "reportes", "tendencia"].includes(sp.tipo ?? "") ? (sp.tipo as string) : "personas";

  let head: string[] = [];
  let rows: (string | number | null)[][] = [];
  if (tipo === "tendencia") {
    const pts = await computeTrend(r.filters, r.gran);
    head = ["Periodo", ...KPI_HEAD];
    rows = pts.map((p) => [p.label, ...kpiCells(p.kpis)]);
  } else {
    const d = await computeDashboard(r.filters);
    if (tipo === "personas") {
      head = ["Persona", "Rol", "Áreas", ...KPI_HEAD, "Aceptadas este mes", "Mensajes de chat", "Respuesta en chat (h)"];
      rows = d.people.map((p) => [p.name, ROLE_LABEL[p.role], p.areas.join(" / "), ...kpiCells(p.kpis), p.streak, p.chat.messages, hrs(p.chat.replyAvgMs)]);
    } else if (tipo === "areas") { head = ["Área", "Tareas", ...KPI_HEAD]; rows = groupRows(d.byArea); }
    else if (tipo === "clientes") { head = ["Cliente", "Tareas", ...KPI_HEAD]; rows = groupRows(d.byClient); }
    else if (tipo === "proyectos") { head = ["Proyecto", "Tareas", ...KPI_HEAD]; rows = groupRows(d.byProject); }
    else if (tipo === "gestion") {
      head = ["Persona", "Rol", "Tareas asignadas", "Con fecha por defecto %", "Editadas %", "Revisiones", "Tiempo de revisión prom. (h)", "Devueltas por esta persona", "Tasa de devolución %"];
      rows = d.management.map((m) => [m.name, ROLE_LABEL[m.role], m.assigned, pct(m.default48Pct), pct(m.editedPct), m.reviews, hrs(m.reviewAvgMs), m.returnedByThem, pct(m.returnRate)]);
    } else {
      head = ["Persona", "Terminados", "Enviados", "Rechazados", "Tasa de rechazo %", "Solicitudes de edición", "Creación → terminado (h)"];
      rows = d.reports.rows.map((x) => [x.name, x.finished, x.sent, x.rejected, pct(x.rejectRate), x.editRequests, hrs(x.toFinishAvgMs)]);
    }
  }

  const lines = [
    [`Desempeño (${tipo})`, `Del ${dayKey(r.filters.from)} al ${dayKey(r.filters.to)}`].map(cell).join(","),
    head.map(cell).join(","),
    ...rows.map((row) => row.map(cell).join(",")),
  ];
  void fmtDur;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Desempeno-${tipo}-${dayKey(r.filters.to)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
