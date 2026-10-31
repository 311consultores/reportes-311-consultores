import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSetting, readLogo311, setSetting } from "@/lib/branding";
import { getBaseUrl } from "@/lib/base-url";
import { sendMail } from "@/lib/mailer";
import { desempenoSemanalEmail, notaRecordatorioEmail, reviewReminderEmail, tareaAsignadaEmail, tareaPorVencerEmail, tareasVencidasEmail, type TareaVencida } from "@/lib/email-templates";
import { htmlToText } from "@/lib/sanitize";
import { notifyUsers, taskManagerIds } from "@/lib/notifications";
import { formatMx } from "@/lib/tasks-shared";
import { publishedWhere } from "@/lib/task-visibility";
import { addDaysIso, dateOnly, fmtDate, todayMx } from "@/lib/finance";
import { computeDashboard, fmtPct, getMeasuredFrom, getThresholds, mxWeekStart, lightFor } from "@/lib/metrics";
import { dayKey } from "@/lib/tasks-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LAST_KEY = "tareas_vencidas_fecha";
const WEEKLY_KEY = "desempeno_semanal_lunes";
/** El resumen semanal de desempeño se envía únicamente a esta dirección. */
const WEEKLY_TO = "necesito@311consultores.com";
const opsEmails = () => (process.env.TEAM_NOTIFY_EMAILS ?? "admon@311consultores.com,necesito@311consultores.com").split(/[,;\s]+/).filter(Boolean);

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Tarea programada (cPanel › Cron Jobs): GET /api/cron/tareas?token=<CRON_TOKEN>. Conviene ejecutarla cada hora.
 *  1) Recordatorio de «vence en menos de 12 horas» (una sola vez por tarea) al TEAM 311 asignado.
 *  2) Aviso diario de tareas vencidas (después de las 8:00 hora de México): a cada persona con sus tareas y un resumen a Administración.
 * Con &force=1 se reenvía el aviso diario aunque ya se haya mandado hoy (para probar).
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_TOKEN?.trim();
  if (!expected) return Response.json({ error: "CRON_TOKEN no está configurado en el servidor" }, { status: 503 });
  const url = new URL(req.url);
  if (!sameToken(url.searchParams.get("token") ?? "", expected)) return Response.json({ error: "No autorizado" }, { status: 403 });

  const now = new Date();
  const base = await getBaseUrl();
  const logo = await readLogo311();
  const inline = logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined;
  const result = { programadas: 0, porVencer: 0, vencidasPersonas: 0, vencidasTotal: 0, resumenAdmin: false, resumenSemanal: false, recordatoriosRevision: 0 };

  // 0) Tareas programadas que ya aparecieron: se avisa a las personas asignadas (campanita, navegador y correo)
  const published = await prisma.task.findMany({
    where: { publishAt: { not: null, lte: now }, publishNotifiedAt: null },
    include: {
      client: { select: { companyName: true } }, project: { select: { projectName: true } }, createdBy: { select: { name: true } },
      assignees: { include: { user: { select: { id: true, email: true, active: true } } } },
    },
  });
  for (const t of published) {
    try {
      const people = t.assignees.map((a) => a.user).filter((u) => u.active);
      if (people.length) {
        await notifyUsers(people.map((u) => u.id), { actorId: t.createdById, kind: "TASK_ASSIGNED", title: `Nueva tarea: ${t.title}`, body: `${t.client.companyName} · ${t.project.projectName} — entrega ${formatMx(t.dueAt)}`, link: `/tareas?tarea=${t.id}` });
        await sendMail({ to: people.map((u) => u.email), ...tareaAsignadaEmail({ title: t.title, clientName: t.client.companyName, projectName: t.project.projectName, due: formatMx(t.dueAt), byName: t.createdBy.name, link: `${base}/tareas?tarea=${t.id}`, withLogo: !!logo }), inline });
      }
      await prisma.task.update({ where: { id: t.id }, data: { publishNotifiedAt: now } });
      result.programadas++;
    } catch (e) {
      console.error("[cron tareas] aviso de tarea programada:", e);
    }
  }

  // 1) Por vencer (menos de 12 horas)
  const soon = await prisma.task.findMany({
    where: { status: { in: ["PENDIENTE", "EN_PROCESO"] }, dueAt: { gt: now, lte: new Date(now.getTime() + 12 * 3600_000) }, reminderSentAt: null, ...publishedWhere(now) },
    include: { client: { select: { companyName: true } }, project: { select: { projectName: true } }, assignees: { include: { user: { select: { id: true, email: true, active: true } } } } },
  });
  for (const t of soon) {
    const people = t.assignees.map((a) => a.user).filter((u) => u.active);
    try {
      if (people.length) {
        await sendMail({ to: people.map((u) => u.email), ...tareaPorVencerEmail({ title: t.title, clientName: t.client.companyName, projectName: t.project.projectName, due: formatMx(t.dueAt), link: `${base}/tareas?tarea=${t.id}`, withLogo: !!logo }), inline });
        await notifyUsers(people.map((u) => u.id), { kind: "TASK_SOON", title: `⏰ Tu tarea vence pronto: ${t.title}`, body: `Entrega: ${formatMx(t.dueAt)}`, link: `/tareas?tarea=${t.id}` });
      }
      await prisma.task.update({ where: { id: t.id }, data: { reminderSentAt: now } });
      result.porVencer++;
    } catch (e) {
      console.error("[cron tareas] recordatorio:", e);
    }
  }

  // 1b) Baúl: recordatorios de notas que ya llegaron a su hora (aviso en la campanita y el navegador, y correo al dueño)
  const dueNotes = await prisma.note.findMany({
    where: { reminderAt: { lte: now }, reminderSentAt: null, trashedAt: null },
    include: { owner: { select: { id: true, email: true, active: true } }, items: { take: 5, orderBy: { position: "asc" } } },
  });
  for (const n of dueNotes) {
    try {
      const snippet = (n.kind === "CHECKLIST" ? n.items.map((i) => i.text).join(" · ") : htmlToText(n.bodyHtml)).slice(0, 200);
      if (n.owner.active) {
        await notifyUsers([n.owner.id], { kind: "NOTE_REMINDER", title: `⏰ Recordatorio: ${n.title || "Nota del Baúl"}`, body: snippet, link: `/baul?nota=${n.id}` });
        await sendMail({ to: [n.owner.email], ...notaRecordatorioEmail({ title: n.title, snippet, link: `${base}/baul?nota=${n.id}`, withLogo: !!logo }), inline });
      }
      await prisma.note.update({ where: { id: n.id }, data: { reminderSentAt: now } });
    } catch (e) {
      console.error("[cron tareas] recordatorio de nota:", e);
    }
  }
  // Papelera del Baúl: lo que lleva más de 30 días se borra
  await prisma.note.deleteMany({ where: { trashedAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } } });

  // 2) Vencidas: una vez al día, a partir de las 8:00 (México)
  const hourMx = Number(new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", hourCycle: "h23" }).format(now));
  const today = todayMx();
  const force = url.searchParams.get("force") === "1";
  if (force || (hourMx >= 8 && (await getSetting(LAST_KEY)) !== today)) {
    const overdue = await prisma.task.findMany({
      where: { status: { in: ["PENDIENTE", "EN_PROCESO"] }, dueAt: { lt: now }, ...publishedWhere(now) },
      orderBy: { dueAt: "asc" },
      include: { client: { select: { companyName: true } }, project: { select: { projectName: true } }, assignees: { include: { user: { select: { id: true, name: true, email: true, active: true } } } } },
    });
    if (overdue.length > 0) {
      const item = (t: (typeof overdue)[number]): TareaVencida => ({
        title: t.title, clientName: t.client.companyName, projectName: t.project.projectName, due: formatMx(t.dueAt),
        people: t.assignees.map((a) => a.user.name).join(", "), daysLate: Math.max(1, Math.round((now.getTime() - t.dueAt.getTime()) / 86_400_000)),
      });
      const perUser = new Map<string, { name: string; email: string; items: TareaVencida[] }>();
      for (const t of overdue) {
        for (const a of t.assignees) {
          if (!a.user.active) continue;
          const e = perUser.get(a.user.id) ?? { name: a.user.name, email: a.user.email, items: [] };
          e.items.push(item(t));
          perUser.set(a.user.id, e);
        }
      }
      try {
        for (const [id, u] of perUser) {
          await sendMail({ to: [u.email], ...tareasVencidasEmail({ forName: u.name, items: u.items, link: `${base}/tareas`, withLogo: !!logo }), inline });
          await notifyUsers([id], { kind: "TASK_OVERDUE", title: `Tienes ${u.items.length === 1 ? "1 tarea vencida" : `${u.items.length} tareas vencidas`}`, body: u.items.map((i) => i.title).slice(0, 3).join(" · "), link: "/tareas" });
        }
        await sendMail({ to: opsEmails(), ...tareasVencidasEmail({ forName: null, items: overdue.map(item), link: `${base}/tareas`, withLogo: !!logo }), inline });
        await notifyUsers(await taskManagerIds(), { kind: "TASK_OVERDUE", title: `${overdue.length === 1 ? "1 tarea vencida" : `${overdue.length} tareas vencidas`} en el equipo`, body: overdue.map((t) => t.title).slice(0, 3).join(" · "), link: "/tareas" });
        if (!force) await setSetting(LAST_KEY, today);
        result.vencidasPersonas = perUser.size;
        result.vencidasTotal = overdue.length;
        result.resumenAdmin = true;
      } catch (e) {
        console.error("[cron tareas] vencidas:", e);
        return Response.json({ ...result, error: "No se pudo enviar el aviso de tareas vencidas" }, { status: 502 });
      }
    }
  }

  // 3) Resumen semanal de desempeño: los lunes a partir de las 8:00 (México), con la semana anterior (lunes a domingo). Solo a necesito@311consultores.com.
  const monday = mxWeekStart(now);
  const mondayKey = dayKey(monday);
  const weeklyForce = url.searchParams.get("semanal") === "1";
  if (weeklyForce || (mondayKey === today && hourMx >= 8 && (await getSetting(WEEKLY_KEY)) !== mondayKey)) {
    try {
      const measuredFrom = await getMeasuredFrom();
      const prevStart = new Date(monday.getTime() - 7 * 86_400_000);
      const to = new Date(monday.getTime() - 1);
      const from = prevStart < measuredFrom ? measuredFrom : prevStart;
      if (to > from) {
        const [d, th] = await Promise.all([computeDashboard({ from, to }, now), getThresholds()]);
        const light = (p: number | null) => (lightFor(p, th) === "red" ? "🔴 " : lightFor(p, th) === "amber" ? "🟠 " : lightFor(p, th) === "green" ? "🟢 " : "");
        const cells = (k: typeof d.team) => [`${light(k.punctuality)}${fmtPct(k.punctuality)} (${k.onTime} de ${k.delivered})`, `${fmtPct(k.returnRate)} (${k.returns})`, String(k.delivered), `${k.open} / ${k.overdue}`];
        const alerts: string[] = [];
        for (const p of d.people) if (p.kpis.delivered > 0 && lightFor(p.kpis.punctuality, th) === "red") alerts.push(`${p.name}: puntualidad ${fmtPct(p.kpis.punctuality)} (${p.kpis.onTime} de ${p.kpis.delivered} a tiempo)`);
        for (const a of d.byArea) if (a.kpis.delivered > 0 && lightFor(a.kpis.punctuality, th) === "red") alerts.push(`Área ${a.name}: puntualidad ${fmtPct(a.kpis.punctuality)}`);
        for (const p of d.loadDist.filter((r) => r.overdue > 0)) alerts.push(`${p.name} tiene ${p.overdue} tarea(s) vencida(s) abierta(s)`);
        const fmtD = (x: Date) => formatMx(x, false);
        const m = await sendMail({
          to: [WEEKLY_TO],
          ...desempenoSemanalEmail({
            periodLabel: `${fmtD(from)} al ${fmtD(to)}`, link: `${base}/desempeno`, withLogo: !!logo, alerts: alerts.slice(0, 12),
            team: [
              { label: "Puntualidad (proporcional)", value: `${fmtPct(d.team.punctuality)} · ${d.team.onTime} de ${d.team.delivered} tareas a tiempo` },
              { label: "Devoluciones", value: `${fmtPct(d.team.returnRate)} (${d.team.returns})` },
              { label: "Tareas abiertas / vencidas", value: `${d.team.open} / ${d.team.overdue}` },
              { label: "Reportes terminados / enviados", value: `${d.reports.finished} / ${d.reports.sent}` },
            ],
            areas: d.byArea.map((g) => ({ name: g.name, cells: cells(g.kpis) })),
            people: d.people.filter((p) => p.role === "TEAM_311" || p.role === "PROJECT_311").map((p) => ({ name: p.name, cells: cells(p.kpis) })),
          }),
          inline,
        });
        void m;
        result.resumenSemanal = true;
      }
      if (!weeklyForce) await setSetting(WEEKLY_KEY, mondayKey);
    } catch (e) {
      console.error("[cron tareas] resumen semanal:", e);
    }
  }
  // 4) Revisiones de parrillas: recordatorio al cliente un día antes de su fecha límite (a partir de las 8:00, una sola vez por revisión)
  if (hourMx >= 8) {
    const due = await prisma.review.findMany({
      where: { status: "PUBLICADA", respondBy: dateOnly(addDaysIso(today, 1)), reminderSentAt: null },
      include: { client: { select: { companyName: true } }, slides: { select: { status: true } } },
    });
    for (const r of due) {
      try {
        const emails = r.notifyEmails.split(/[,;s]+/).filter(Boolean);
        if (emails.length) {
          await sendMail({
            to: emails,
            ...reviewReminderEmail({
              clientName: r.client.companyName, title: r.title, respondBy: fmtDate(r.respondBy!), pending: r.slides.filter((s) => s.status !== "APROBADO").length,
              link: `${base}/revisiones/${r.id}`, withLogo: !!logo,
            }),
            inline,
          });
        }
        await prisma.review.update({ where: { id: r.id }, data: { reminderSentAt: now } });
        result.recordatoriosRevision++;
      } catch (e) {
        console.error("[cron tareas] recordatorio de revisión:", e);
      }
    }
  }

  return Response.json({ ok: true, ...result });
}
