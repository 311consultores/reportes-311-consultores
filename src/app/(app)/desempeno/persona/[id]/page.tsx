import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/avatar";
import { ROLE_LABEL } from "@/lib/roles";
import { formatMx } from "@/lib/tasks-shared";
import { computeDashboard, computeTrend, deliveredRows, fmtDur, fmtPct, lightFor, resolveFilters, type Kpis, type Light } from "@/lib/metrics";
import { TrendChart } from "../../trend-chart";

export const metadata = { title: "Ficha de desempeño | Portal de Operaciones" };

const COLORS: Record<Light, string> = { green: "#34C759", amber: "#FF9500", red: "#FF3B30", none: "#C7C7CC" };

/** Diferencia contra una referencia (puntos porcentuales o tiempo). `better` indica si subir es bueno. */
function Delta({ now, vs: r, unit, better }: { now: number | null; vs: number | null; unit: "pct" | "ms"; better: "up" | "down" }) {
  if (now === null || r === null) return <span className="meta text-xs">sin comparación</span>;
  const diff = now - r;
  const same = unit === "pct" ? Math.abs(diff) < 0.5 : Math.abs(diff) < 60_000;
  if (same) return <span className="meta text-xs">igual que la referencia</span>;
  const good = better === "up" ? diff > 0 : diff < 0;
  const txt = unit === "pct" ? `${diff > 0 ? "+" : ""}${Math.round(diff)} pts` : `${diff > 0 ? "+" : "−"}${fmtDur(Math.abs(diff))}`;
  return <span className="text-xs font-medium" style={{ color: good ? "#1E9E45" : "#D70015" }}>{good ? "▲" : "▼"} {txt}</span>;
}

function Stat({ label, value, sub, light, children }: { label: string; value: string; sub?: string; light?: Light; children?: React.ReactNode }) {
  return (
    <div className="card space-y-1 p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">{light && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[light] }} />}{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="meta text-xs">{sub}</p>}
      {children && <p className="flex flex-col gap-0.5 pt-1">{children}</p>}
    </div>
  );
}

export default async function PersonCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const person = await prisma.user.findFirst({
    where: { id, role: { in: ["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"] } },
    select: { id: true, name: true, email: true, role: true, photoUrl: true, active: true, areas: { select: { area: { select: { name: true, color: true } } } } },
  });
  if (!person) notFound();

  const r = await resolveFilters(sp, { ignorePerson: true });
  const base = r.filters;
  const mine = { ...base, personId: person.id };
  // Periodo anterior de la misma duración (solo si cae dentro de lo que se mide)
  const len = base.to.getTime() - base.from.getTime();
  const prevFrom = new Date(base.from.getTime() - len - 1);
  const hasPrev = prevFrom >= r.measuredFrom;
  const [dash, teamDash, trend, delivered, prevDash] = await Promise.all([
    computeDashboard(mine),
    computeDashboard(base),
    computeTrend(mine, r.gran),
    deliveredRows(mine),
    hasPrev ? computeDashboard({ ...mine, from: prevFrom, to: new Date(base.from.getTime() - 1) }) : Promise.resolve(null),
  ]);
  const row = dash.people.find((p) => p.id === person.id);
  const k: Kpis | undefined = row?.kpis;
  const tk = teamDash.team;
  const pk = prevDash?.people.find((p) => p.id === person.id)?.kpis ?? null;
  const mg = dash.management.find((m) => m.id === person.id);
  const rep = dash.reports.rows.find((x) => x.id === person.id);
  const t = r.thresholds;
  const qs = new URLSearchParams(Object.entries(sp).filter(([k2, v]) => v && k2 !== "persona") as [string, string][]).toString();
  const back = `/desempeno${qs ? `?${qs}` : ""}`;
  const gran = (g: string) => `?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(qs)), gran: g }).toString()}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={person.name} userId={person.id} photoKey={person.photoUrl} size={56} />
        <div className="mr-auto">
          <h1 className="page-title">{person.name}</h1>
          <p className="meta">{ROLE_LABEL[person.role]}{person.active ? "" : " · Inactivo"} · {person.email}</p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {person.areas.map((a) => <span key={a.area.name} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: a.area.color }}>{a.area.name}</span>)}
          </p>
        </div>
        <Link href={back} className="btn-outline">← Volver al dashboard</Link>
      </div>
      <p className="meta">Periodo: {formatMx(base.from, false)} al {formatMx(base.to, false)}. Se compara contra la meta del equipo (misma gente y filtros){hasPrev ? " y contra el periodo anterior de la misma duración" : ""}. Sin ranking: cada persona se mide contra la meta y contra sí misma.</p>

      {k && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Entrega de tareas</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Puntualidad (proporcional)" value={fmtPct(k.punctuality)} sub={`${k.onTime} de ${k.delivered} tareas a tiempo`} light={lightFor(k.punctuality, t)}>
              <span className="meta text-xs">Equipo: {fmtPct(tk.punctuality)}</span><Delta now={k.punctuality} vs={tk.punctuality} unit="pct" better="up" />
              {pk && <><span className="meta text-xs">Periodo anterior: {fmtPct(pk.punctuality)}</span><Delta now={k.punctuality} vs={pk.punctuality} unit="pct" better="up" /></>}
            </Stat>
            <Stat label="Retraso promedio" value={fmtDur(k.lateAvgMs)} sub={`${k.lateCount} tarea(s) tardía(s)`}>
              <span className="meta text-xs">Equipo: {fmtDur(tk.lateAvgMs)}</span>
            </Stat>
            <Stat label="Devoluciones" value={fmtPct(k.returnRate)} sub={`${k.returns} devolución(es)`}>
              <span className="meta text-xs">Equipo: {fmtPct(tk.returnRate)}</span><Delta now={k.returnRate} vs={tk.returnRate} unit="pct" better="down" />
              {pk && <><span className="meta text-xs">Periodo anterior: {fmtPct(pk.returnRate)}</span><Delta now={k.returnRate} vs={pk.returnRate} unit="pct" better="down" /></>}
            </Stat>
            <Stat label="Tiempo de ciclo" value={fmtDur(k.cycleAvgMs)} sub={`${k.accepted} aceptada(s)`}>
              <span className="meta text-xs">Equipo: {fmtDur(tk.cycleAvgMs)}</span><Delta now={k.cycleAvgMs} vs={tk.cycleAvgMs} unit="ms" better="down" />
            </Stat>
            <Stat label="Tiempo de respuesta" value={fmtDur(k.responseAvgMs)} sub="Asignación → «En proceso»">
              <span className="meta text-xs">Equipo: {fmtDur(tk.responseAvgMs)}</span><Delta now={k.responseAvgMs} vs={tk.responseAvgMs} unit="ms" better="down" />
            </Stat>
            <Stat label="Subtareas completadas" value={fmtPct(k.subtaskPct)} sub="Al entregar la tarea" />
            <Stat label="Carga actual" value={String(k.open)} sub={`${k.overdue} vencida(s) · ${k.soon} por vencer (12 h)`} light={k.overdue ? "red" : k.soon ? "amber" : "green"} />
            <Stat label="Aceptadas este mes (racha)" value={String(row?.streak ?? 0)} />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-lg font-semibold tracking-tight">Tendencia</h2>
          <span className="inline-flex overflow-hidden rounded-xl border border-black/10 text-sm dark:border-white/10" role="group" aria-label="Agrupar por">
            <Link href={gran("semana")} className={`px-3 py-1.5 font-medium ${r.gran === "semana" ? "bg-[#007AFF] text-white" : "hover:bg-black/5 dark:hover:bg-white/10"}`}>Por semana</Link>
            <Link href={gran("mes")} className={`px-3 py-1.5 font-medium ${r.gran === "mes" ? "bg-[#007AFF] text-white" : "hover:bg-black/5 dark:hover:bg-white/10"}`}>Por mes</Link>
          </span>
        </div>
        <TrendChart points={trend} t={t} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Tareas entregadas en el periodo</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10"><tr><th className="th">Tarea</th><th className="th">Cliente</th><th className="th">Área</th><th className="th">Fecha límite</th><th className="th">Entregada</th><th className="th">Calificación</th><th className="th">Retraso</th><th className="th">Devoluciones</th></tr></thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {delivered.map((d) => (
                <tr key={d.id}>
                  <td className="td font-medium"><Link className="link" href={`/tareas?tarea=${d.id}`}>{d.title}</Link></td>
                  <td className="td">{d.client}</td><td className="td">{d.area ?? "Sin área"}</td>
                  <td className="td whitespace-nowrap">{formatMx(d.dueAt)}</td><td className="td whitespace-nowrap">{formatMx(d.deliveredAt)}</td>
                  <td className="td"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[lightFor(d.score, t)] }} />{fmtPct(d.score)}</span></td>
                  <td className="td whitespace-nowrap">{d.lateMs ? fmtDur(d.lateMs) : "A tiempo"}</td><td className="td">{d.returns}</td>
                </tr>
              ))}
              {delivered.length === 0 && <tr><td colSpan={8} className="td py-6 text-center text-zinc-500">Sin tareas entregadas en este periodo</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {person.role !== "TEAM_311" && mg && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Gestión</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Tareas asignadas" value={String(mg.assigned)} />
            <Stat label="Con fecha por defecto (48 h)" value={fmtPct(mg.default48Pct)} />
            <Stat label="Editadas después de crearse" value={fmtPct(mg.editedPct)} />
            <Stat label="Tiempo de revisión" value={fmtDur(mg.reviewAvgMs)} sub={`${mg.reviews} revisión(es) · ${mg.returnedByThem} devuelta(s)`} />
          </div>
        </section>
      )}

      {rep && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Reportes</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Terminados" value={String(rep.finished)} sub={`${rep.sent} enviado(s)`} />
            <Stat label="Tasa de rechazo" value={fmtPct(rep.rejectRate)} sub={`${rep.rejected} rechazo(s)`} />
            <Stat label="Solicitudes de edición" value={String(rep.editRequests)} />
            <Stat label="Creación → terminado" value={fmtDur(rep.toFinishAvgMs)} />
          </div>
        </section>
      )}

      {row && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Chat de las tareas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Mensajes" value={String(row.chat.messages)} />
            <Stat label="Tiempo de respuesta a un comentario" value={fmtDur(row.chat.replyAvgMs)} />
          </div>
        </section>
      )}
    </div>
  );
}
