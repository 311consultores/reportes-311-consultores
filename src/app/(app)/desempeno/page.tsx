import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { STATUS_INFO, formatMx } from "@/lib/tasks-shared";
import {
  computeDashboard, fmtDur, fmtPct, getMeasuredFrom, getThresholds, lightFor, parsePeriodParams, type GroupRow, type Kpis, type Light, type Thresholds,
} from "@/lib/metrics";

export const metadata = { title: "Desempeño | Portal de Operaciones" };

const COLORS: Record<Light, string> = { green: "#34C759", amber: "#FF9500", red: "#FF3B30", none: "#C7C7CC" };
const LIGHT_TEXT: Record<Light, string> = { green: "En meta", amber: "Atención", red: "Por debajo de la meta", none: "Sin datos" };

function Dot({ light }: { light: Light }) {
  return <span title={LIGHT_TEXT[light]} aria-label={LIGHT_TEXT[light]} className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[light] }} />;
}

function Tile({ label, value, sub, light, hint }: { label: string; value: string; sub?: string; light?: Light; hint?: string }) {
  return (
    <div className="card space-y-1 p-4" title={hint}>
      <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">{light && <Dot light={light} />}{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="meta text-xs">{sub}</p>}
    </div>
  );
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint && <p className="meta">{hint}</p>}
    </div>
    {children}
  </section>
);

/** Celda «Puntualidad»: porcentaje con semáforo y el conteo «X de Y a tiempo» al lado. */
function Punct({ k, t }: { k: Kpis; t: Thresholds }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Dot light={lightFor(k.punctuality, t)} /> {fmtPct(k.punctuality)}
      <span className="meta text-xs">({k.onTime} de {k.delivered} a tiempo)</span>
    </span>
  );
}

function GroupTable({ rows, t, empty }: { rows: GroupRow[]; t: Thresholds; empty: string }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full">
        <thead className="border-b border-black/5 dark:border-white/10">
          <tr><th className="th">Nombre</th><th className="th">Tareas</th><th className="th">Entregadas</th><th className="th">Puntualidad</th><th className="th">Devoluciones</th><th className="th">Ciclo</th><th className="th">Abiertas / vencidas</th></tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {rows.map((g) => (
            <tr key={g.id}>
              <td className="td font-medium"><span className="flex items-center gap-2">{g.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />}{g.name}</span></td>
              <td className="td">{g.tasks}</td>
              <td className="td">{g.kpis.delivered}</td>
              <td className="td"><Punct k={g.kpis} t={t} /></td>
              <td className="td">{fmtPct(g.kpis.returnRate)} <span className="meta text-xs">({g.kpis.returns})</span></td>
              <td className="td whitespace-nowrap">{fmtDur(g.kpis.cycleAvgMs)}</td>
              <td className="td">{g.kpis.open} / <span className={g.kpis.overdue ? "font-semibold text-[#FF3B30]" : ""}>{g.kpis.overdue}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="td py-6 text-center text-zinc-500">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const [measuredFrom, thresholds, clients, areas, people] = await Promise.all([
    getMeasuredFrom(),
    getThresholds(),
    prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    prisma.area.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
  ]);
  const period = parsePeriodParams(sp, measuredFrom);
  const personId = people.some((p) => p.id === sp.persona) ? sp.persona : undefined;
  const clientId = clients.some((c) => c.id === sp.cliente) ? sp.cliente : undefined;
  const areaId = sp.area === "none" || areas.some((a) => a.id === sp.area) ? sp.area : undefined;
  const d = await computeDashboard({ from: period.from, to: period.to, personId, clientId, areaId });
  const t = thresholds;
  const k = d.team;
  const maxLoad = Math.max(1, ...d.loadDist.map((r) => r.open));
  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count));
  const opsPeople = d.people.filter((p) => p.role === "TEAM_311" || p.role === "PROJECT_311");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Desempeño</h1>
        <p className="meta">Medido desde el {formatMx(measuredFrom, false)}. Periodo mostrado: {formatMx(period.from, false)} al {formatMx(period.to, false)}.{period.clamped ? " (El inicio se ajustó a la fecha desde la que se mide.)" : ""}</p>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="f-periodo">Periodo</label>
          <select id="f-periodo" name="periodo" defaultValue={period.key} className="input !w-auto">
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="mes">Este mes</option>
            <option value="mes-ant">Mes anterior</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        <div><label className="label" htmlFor="f-desde">Desde</label><input id="f-desde" type="date" name="desde" defaultValue={period.key === "custom" ? period.desde : ""} className="input !w-auto" /></div>
        <div><label className="label" htmlFor="f-hasta">Hasta</label><input id="f-hasta" type="date" name="hasta" defaultValue={period.key === "custom" ? period.hasta : ""} className="input !w-auto" /></div>
        <div>
          <label className="label" htmlFor="f-persona">Persona</label>
          <select id="f-persona" name="persona" defaultValue={personId ?? ""} className="input !w-auto">
            <option value="">Todas</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {ROLE_LABEL[p.role]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-cliente">Cliente</label>
          <select id="f-cliente" name="cliente" defaultValue={clientId ?? ""} className="input !w-auto">
            <option value="">Todos</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-area">Área</label>
          <select id="f-area" name="area" defaultValue={areaId ?? ""} className="input !w-auto">
            <option value="">Todas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="none">Sin área</option>
          </select>
        </div>
        <button className="btn" type="submit">Aplicar</button>
        <Link href="/desempeno" className="btn-outline">Limpiar</Link>
      </form>

      <Section title="Resumen del equipo" hint="Ninguna cifra va sola: una buena puntualidad con muchas devoluciones es un riesgo, no un mérito. Junto a cada porcentaje se muestra cuántas tareas hay detrás.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Puntualidad (proporcional)" value={fmtPct(k.punctuality)} sub={`${k.onTime} de ${k.delivered} tareas a tiempo`} light={lightFor(k.punctuality, t)} hint="100 % si se entrega a tiempo; si no, se descuenta el retraso en proporción al tiempo que se tenía para entregar." />
          <Tile label="Retraso promedio" value={fmtDur(k.lateAvgMs)} sub={`${k.lateCount} tarea(s) tardía(s)`} />
          <Tile label="Devoluciones" value={fmtPct(k.returnRate)} sub={`${k.returns} devolución(es)`} hint="Veces que una tarea volvió de «Para revisar» a «En proceso», entre las entregas del periodo." />
          <Tile label="Tiempo de ciclo" value={fmtDur(k.cycleAvgMs)} sub={`${k.accepted} aceptada(s)`} hint="Desde que se crea la tarea hasta que se acepta." />
          <Tile label="Tiempo de respuesta" value={fmtDur(k.responseAvgMs)} sub="Asignación → «En proceso»" />
          <Tile label="Subtareas completadas" value={fmtPct(k.subtaskPct)} sub="Al entregar la tarea" />
          <Tile label="Abiertas ahora" value={String(k.open)} sub={`${k.overdue} vencida(s) · ${k.soon} por vencer (12 h)`} light={k.overdue ? "red" : k.soon ? "amber" : "green"} />
          <Tile label="Reportes terminados" value={String(d.reports.finished)} sub={`${d.reports.sent} enviado(s)`} />
        </div>
      </Section>

      <Section title="Embudo de tareas" hint="Cuántas hay en cada fase y cuánto llevan ahí en promedio. Revela dónde se atoran.">
        <div className="card space-y-3">
          {d.funnel.map((f) => (
            <div key={f.status} className="grid grid-cols-[9rem_1fr_9rem] items-center gap-3 text-sm">
              <span className="font-medium">{STATUS_INFO[f.status].emoji} {STATUS_INFO[f.status].label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><span className="block h-full rounded-full" style={{ width: `${(f.count / maxFunnel) * 100}%`, backgroundColor: STATUS_INFO[f.status].dot }} /></span>
              <span className="meta text-right">{f.count}{f.status === "TERMINADA" ? " en el periodo" : ` · ${fmtDur(f.avgAgeMs)} en la fase`}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Por persona" hint="Cada persona se compara con la meta del equipo, no contra las demás. Solo cuentan las tareas donde está asignada.">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10">
              <tr><th className="th">Persona</th><th className="th">Áreas</th><th className="th">Entregadas</th><th className="th">Puntualidad</th><th className="th">Retraso prom.</th><th className="th">Devoluciones</th><th className="th">Ciclo</th><th className="th">Respuesta</th><th className="th">Subtareas</th><th className="th">Abiertas / venc.</th><th className="th">Aceptadas (mes)</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {opsPeople.map((p) => (
                <tr key={p.id}>
                  <td className="td font-medium">{p.name}<span className="meta block text-xs font-normal">{ROLE_LABEL[p.role]}</span></td>
                  <td className="td text-xs">{p.areas.join(", ") || "—"}</td>
                  <td className="td">{p.kpis.delivered}</td>
                  <td className="td"><Punct k={p.kpis} t={t} /></td>
                  <td className="td whitespace-nowrap">{fmtDur(p.kpis.lateAvgMs)}</td>
                  <td className="td">{fmtPct(p.kpis.returnRate)} <span className="meta text-xs">({p.kpis.returns})</span></td>
                  <td className="td whitespace-nowrap">{fmtDur(p.kpis.cycleAvgMs)}</td>
                  <td className="td whitespace-nowrap">{fmtDur(p.kpis.responseAvgMs)}</td>
                  <td className="td">{fmtPct(p.kpis.subtaskPct)}</td>
                  <td className="td">{p.kpis.open} / <span className={p.kpis.overdue ? "font-semibold text-[#FF3B30]" : ""}>{p.kpis.overdue}</span></td>
                  <td className="td">{p.streak}</td>
                </tr>
              ))}
              {opsPeople.length === 0 && <tr><td colSpan={11} className="td py-6 text-center text-zinc-500">Sin personas para mostrar</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Por área" hint="Cada tarea cuenta en el área que se eligió al crearla. Las anteriores a la actualización aparecen como «Sin área».">
        <GroupTable rows={d.byArea} t={t} empty="Aún no hay tareas con área en este periodo" />
      </Section>

      <Section title="Por cliente">
        <GroupTable rows={d.byClient} t={t} empty="Sin tareas en este periodo" />
      </Section>

      <Section title="Por proyecto">
        <GroupTable rows={d.byProject} t={t} empty="Sin tareas en este periodo" />
      </Section>

      <Section title="Distribución de la carga" hint="Tareas abiertas por persona ahora mismo: quién está saturado y quién tiene espacio para reasignar.">
        <div className="card space-y-2.5">
          {d.loadDist.map((r) => (
            <div key={r.id} className="grid grid-cols-[10rem_1fr_9rem] items-center gap-3 text-sm">
              <span className="truncate font-medium">{r.name}</span>
              <span className="h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><span className="block h-full rounded-full bg-[#007AFF]" style={{ width: `${(r.open / maxLoad) * 100}%` }} /></span>
              <span className="meta text-right">{r.open} abierta(s){r.overdue ? ` · ${r.overdue} vencida(s)` : ""}</span>
            </div>
          ))}
          {d.loadDist.length === 0 && <p className="meta">Nadie tiene tareas abiertas.</p>}
        </div>
      </Section>

      <Section title="Calidad de la asignación" hint="Tareas creadas en el periodo: cuántas se editaron después de crearse y cuántas se dejaron con la fecha límite por defecto (48 horas).">
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Tareas creadas" value={String(d.assignment.created)} />
          <Tile label="Editadas después de crearse" value={fmtPct(d.assignment.created ? (d.assignment.edited / d.assignment.created) * 100 : null)} sub={`${d.assignment.edited} de ${d.assignment.created}`} />
          <Tile label="Con fecha por defecto (48 h)" value={fmtPct(d.assignment.created ? (d.assignment.default48 / d.assignment.created) * 100 : null)} sub={`${d.assignment.default48} de ${d.assignment.created}`} />
        </div>
      </Section>

      <Section title="Calidad de la gestión" hint="ADMINISTRADOR, EDITOR y PROJECT 311: cuántas tareas asignan, cuánto tardan en revisarlas y cuántas devuelven.">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10">
              <tr><th className="th">Persona</th><th className="th">Tareas asignadas</th><th className="th">Con fecha por defecto</th><th className="th">Editadas</th><th className="th">Revisiones</th><th className="th">Tiempo de revisión</th><th className="th">Devueltas por esta persona</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {d.management.map((m) => (
                <tr key={m.id}>
                  <td className="td font-medium">{m.name}<span className="meta block text-xs font-normal">{ROLE_LABEL[m.role]}</span></td>
                  <td className="td">{m.assigned}</td>
                  <td className="td">{fmtPct(m.default48Pct)}</td>
                  <td className="td">{fmtPct(m.editedPct)}</td>
                  <td className="td">{m.reviews}</td>
                  <td className="td whitespace-nowrap">{fmtDur(m.reviewAvgMs)}</td>
                  <td className="td">{fmtPct(m.returnRate)} <span className="meta text-xs">({m.returnedByThem})</span></td>
                </tr>
              ))}
              {d.management.length === 0 && <tr><td colSpan={7} className="td py-6 text-center text-zinc-500">Sin datos</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Reportes" hint="Reportes terminados y enviados en el periodo, rechazos (los atribuye a quien hizo el reporte) y solicitudes de edición.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Terminados" value={String(d.reports.finished)} />
          <Tile label="Enviados" value={String(d.reports.sent)} />
          <Tile label="Tasa de rechazo" value={fmtPct(d.reports.rejectRate)} sub={`${d.reports.rejected} rechazo(s) · ${d.reports.editRequests} solicitud(es) de edición`} />
          <Tile label="Creación → terminado" value={fmtDur(d.reports.toFinishAvgMs)} />
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10">
              <tr><th className="th">Persona</th><th className="th">Terminados</th><th className="th">Enviados</th><th className="th">Rechazados</th><th className="th">Tasa de rechazo</th><th className="th">Solicitudes de edición</th><th className="th">Creación → terminado</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {d.reports.rows.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium">{r.name}</td><td className="td">{r.finished}</td><td className="td">{r.sent}</td><td className="td">{r.rejected}</td>
                  <td className="td">{fmtPct(r.rejectRate)}</td><td className="td">{r.editRequests}</td><td className="td whitespace-nowrap">{fmtDur(r.toFinishAvgMs)}</td>
                </tr>
              ))}
              {d.reports.rows.length === 0 && <tr><td colSpan={7} className="td py-6 text-center text-zinc-500">Sin movimientos de reportes en este periodo</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Participación en el chat de las tareas">
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile label="Mensajes en el periodo" value={String(d.chat.messages)} />
          <Tile label="Tiempo de respuesta a un comentario" value={fmtDur(d.chat.replyAvgMs)} sub="Desde el mensaje de otra persona hasta la respuesta" />
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10"><tr><th className="th">Persona</th><th className="th">Mensajes</th><th className="th">Tiempo de respuesta</th></tr></thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {d.people.filter((p) => p.chat.messages > 0).map((p) => (
                <tr key={p.id}><td className="td font-medium">{p.name}</td><td className="td">{p.chat.messages}</td><td className="td whitespace-nowrap">{fmtDur(p.chat.replyAvgMs)}</td></tr>
              ))}
              {d.people.every((p) => p.chat.messages === 0) && <tr><td colSpan={3} className="td py-6 text-center text-zinc-500">Sin mensajes en este periodo</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <p className="meta text-xs">Semáforo de puntualidad: verde desde {t.green} %, ámbar de {t.amber} % a {t.green - 1} %, rojo por debajo de {t.amber} %. {d.taskCount} tarea(s) consideradas con los filtros actuales.</p>
    </div>
  );
}
