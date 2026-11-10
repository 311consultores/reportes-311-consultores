import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { putObject } from "@/lib/storage";
import { SLOT_INFO, matchesSignature } from "@/lib/invoice-files";
import { centsToDecimal, dateOnly, formatCents, isValidIsoDate, parseMoney, todayMx } from "@/lib/finance";
import { isUrgency, MAX_RECEIPT, urgencyLabel } from "@/lib/reimbursements";
import { notifyUsers } from "@/lib/notifications";
import { sendMail } from "@/lib/mailer";
import { readLogo311 } from "@/lib/branding";
import { getBaseUrl } from "@/lib/base-url";
import { reembolsoSolicitadoEmail } from "@/lib/email-templates";

export const runtime = "nodejs";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** El TEAM 311 solicita un reembolso: concepto, monto, fecha, urgencia y comprobante (foto o PDF, obligatorio). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TEAM_311") return json({ error: "No autorizado" }, 403);
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return json({ error: "No se pudo leer el formulario" }, 400);
  }
  const concept = String(fd.get("concept") ?? "").trim();
  const cents = parseMoney(String(fd.get("amount") ?? ""));
  const spentOn = String(fd.get("spentOn") ?? "");
  const urgency = String(fd.get("urgency") ?? "");
  const clientId = String(fd.get("clientId") ?? "");
  const projectId = String(fd.get("projectId") ?? "");
  const file = fd.get("receipt");

  if (concept.length < 3) return json({ error: "Escribe el concepto del reembolso" }, 400);
  if (concept.length > 200) return json({ error: "El concepto es demasiado largo" }, 400);
  if (cents === null) return json({ error: "El monto debe ser mayor a cero (por ejemplo 350.00)" }, 400);
  if (!isValidIsoDate(spentOn) || spentOn > todayMx()) return json({ error: "Indica la fecha en que hiciste el gasto (no puede ser futura)" }, 400);
  if (!isUrgency(urgency)) return json({ error: "Elige cuándo necesitas que se te devuelva" }, 400);
  if (!(file instanceof File) || file.size === 0) return json({ error: "El comprobante (foto o PDF) es obligatorio" }, 400);
  if (file.size > MAX_RECEIPT) return json({ error: "El comprobante pesa más de 10 MB" }, 400);

  const mime = (file.type || "").toLowerCase();
  const ext = SLOT_INFO.COMPROBANTE.mimes[mime];
  if (!ext) return json({ error: "El comprobante debe ser una foto JPG o PNG, o un PDF" }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature("COMPROBANTE", mime, buf)) return json({ error: "El contenido no coincide con el tipo de archivo" }, 400);

  // Cliente y proyecto son opcionales; si se eligen deben ser consistentes
  let cId: string | null = null;
  let pId: string | null = null;
  if (/^[0-9a-f-]{36}$/i.test(clientId)) {
    if (!(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) return json({ error: "El cliente no existe" }, 400);
    cId = clientId;
    if (/^[0-9a-f-]{36}$/i.test(projectId)) {
      if (!(await prisma.project.findFirst({ where: { id: projectId, clientId }, select: { id: true } }))) return json({ error: "El proyecto no pertenece al cliente" }, 400);
      pId = projectId;
    }
  }

  const key = `reembolsos/${user.id}/${randomUUID()}.${ext}`;
  await putObject(key, buf, mime);
  const r = await prisma.reimbursement.create({
    data: {
      requestedById: user.id, concept, amount: centsToDecimal(cents), spentOn: dateOnly(spentOn), urgency, clientId: cId, projectId: pId,
      receiptKey: key, receiptName: (file.name || `comprobante.${ext}`).slice(0, 190), receiptType: mime,
    },
  });

  // Aviso al ADMINISTRADOR: campanita (y notificación del navegador) y correo
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true, email: true } });
    await notifyUsers(admins.map((a) => a.id), {
      actorId: user.id, kind: "REIMB_REQUESTED", title: `Reembolso solicitado: ${concept}`,
      body: `${user.name} — ${formatCents(cents)} · ${urgencyLabel(urgency)}`, link: `/reembolsos?reembolso=${r.id}`,
    });
    const logo = await readLogo311();
    const mail = reembolsoSolicitadoEmail({ who: user.name, concept, amount: formatCents(cents), urgency: urgencyLabel(urgency), link: `${await getBaseUrl()}/reembolsos`, withLogo: !!logo });
    await sendMail({
      to: admins.map((a) => a.email), ...mail,
      inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined,
    });
  } catch (e) {
    console.error("[reembolsos] no se pudo avisar:", e);
  }
  return json({ ok: true, id: r.id });
}
