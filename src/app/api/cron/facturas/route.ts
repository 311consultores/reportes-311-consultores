import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSetting, readLogo311, setSetting } from "@/lib/branding";
import { getBaseUrl } from "@/lib/base-url";
import { sendMail } from "@/lib/mailer";
import { facturasVencidasEmail } from "@/lib/email-templates";
import { dateOnly, formatCents, decimalToCents, fmtDate, isoDate, KIND_LABEL, todayMx } from "@/lib/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LAST_KEY = "facturas_alerta_fecha";
const alertEmail = () => process.env.FACTURAS_ALERT_EMAIL?.trim() || "admon@311consultores.com";

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Tarea diaria (cPanel › Cron Jobs): GET /api/cron/facturas?token=<CRON_TOKEN>
 * Si hay facturas o recibos vencidos, manda UN correo con la lista a Administración (una vez por día).
 * Con &force=1 reenvía aunque ya se haya mandado hoy (útil para probar).
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_TOKEN?.trim();
  if (!expected) return Response.json({ error: "CRON_TOKEN no está configurado en el servidor" }, { status: 503 });
  const url = new URL(req.url);
  if (!sameToken(url.searchParams.get("token") ?? "", expected)) return Response.json({ error: "No autorizado" }, { status: 403 });

  const today = todayMx();
  const force = url.searchParams.get("force") === "1";
  if (!force && (await getSetting(LAST_KEY)) === today) return Response.json({ ok: true, skipped: "ya se envió hoy" });

  const overdue = await prisma.invoice.findMany({
    where: { status: "ENVIADA", dueDate: { lt: dateOnly(today) } },
    include: { client: { select: { companyName: true } } },
    orderBy: { dueDate: "asc" },
  });
  if (overdue.length === 0) return Response.json({ ok: true, vencidas: 0 });

  const dayMs = 86_400_000;
  const totalCents = overdue.reduce((s, i) => s + decimalToCents(i.total), 0);
  const logo = await readLogo311();
  const mail = facturasVencidasEmail({
    items: overdue.map((i) => ({
      client: i.client.companyName,
      kind: KIND_LABEL[i.kind],
      number: i.number,
      description: i.description,
      total: formatCents(decimalToCents(i.total)),
      dueDate: fmtDate(i.dueDate),
      daysLate: Math.max(1, Math.round((dateOnly(today).getTime() - dateOnly(isoDate(i.dueDate)).getTime()) / dayMs)),
    })),
    total: formatCents(totalCents),
    link: `${await getBaseUrl()}/facturas?estado=VENCIDA`,
    withLogo: !!logo,
  });

  try {
    const { dryRun } = await sendMail({
      to: [alertEmail()],
      ...mail,
      inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined,
    });
    if (!force) await setSetting(LAST_KEY, today);
    return Response.json({ ok: true, vencidas: overdue.length, enviado: !dryRun, dryRun });
  } catch (e) {
    console.error("[cron facturas] no se pudo enviar el aviso:", e);
    return Response.json({ error: "No se pudo enviar el correo" }, { status: 500 });
  }
}
