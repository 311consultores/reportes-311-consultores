import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { readLogo311 } from "@/lib/branding";
import { getBaseUrl } from "@/lib/base-url";
import { tareaAsignadaEmail } from "@/lib/email-templates";
import { notifyUsers } from "@/lib/notifications";
import { formatMx } from "@/lib/tasks-shared";

/** Plazo de una tarea encadenada en milisegundos (días + horas). */
export const waitMs = (days: number | null, hours: number | null) => ((days ?? 0) * 24 + (hours ?? 0)) * 3600_000;

/**
 * Activa las tareas que esperaban a `prevId`: su plazo empieza a contar desde este instante exacto
 * (aprobación de la anterior, o su eliminación). Avisa por campanita, notificación y correo. En cascada cada una espera a la suya.
 */
export async function activateDependents(prevId: string, opts: { actorId: string | null; reason: "APROBADA" | "ELIMINADA"; prevTitle: string }): Promise<number> {
  const waiting = await prisma.task.findMany({
    where: { prevTaskId: prevId, activatedAt: null },
    include: {
      client: { select: { companyName: true } },
      project: { select: { projectName: true } },
      createdBy: { select: { name: true } },
      assignees: { include: { user: { select: { id: true, email: true, active: true } } } },
    },
  });
  const now = new Date();
  for (const t of waiting) {
    const dueAt = new Date(now.getTime() + waitMs(t.waitDays, t.waitHours));
    await prisma.$transaction([
      prisma.task.update({ where: { id: t.id }, data: { activatedAt: now, dueAt, reminderSentAt: null } }),
      prisma.taskEvent.create({
        data: {
          taskId: t.id, userId: opts.actorId ?? t.createdById, kind: "ACTIVATED",
          note: opts.reason === "APROBADA" ? `Se activó: se aprobó «${opts.prevTitle}». Entrega ${formatMx(dueAt)}` : `Se activó: se eliminó «${opts.prevTitle}». Entrega ${formatMx(dueAt)}`,
        },
      }),
    ]);
    const people = t.assignees.map((a) => a.user).filter((u) => u.active);
    const why = opts.reason === "APROBADA" ? `Se aprobó «${opts.prevTitle}»` : `Se eliminó «${opts.prevTitle}», la tarea que esperabas`;
    try {
      await notifyUsers(people.map((u) => u.id), { actorId: opts.actorId, kind: "TASK_ASSIGNED", title: `Ya puedes empezar: ${t.title}`, body: `${why} — entrega ${formatMx(dueAt)}`, link: `/tareas?tarea=${t.id}` });
      const logo = await readLogo311();
      const mail = tareaAsignadaEmail({ title: t.title, clientName: t.client.companyName, projectName: t.project.projectName, due: formatMx(dueAt), byName: t.createdBy.name, link: `${await getBaseUrl()}/tareas?tarea=${t.id}`, withLogo: !!logo });
      await sendMail({
        to: people.map((u) => u.email), ...mail, subject: `Ya puedes empezar: ${t.title}`,
        inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined,
      });
    } catch (e) {
      console.error("[tareas] no se pudo avisar la activación:", e);
    }
  }
  return waiting.length;
}
