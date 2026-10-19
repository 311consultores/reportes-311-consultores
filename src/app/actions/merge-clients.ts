"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { auditDetails } from "@/lib/consultants";
import { deleteObject } from "@/lib/storage";
import { splitEmails, uniqueEmails } from "@/lib/emails";

type Result = { error?: string; ok?: boolean };

const side = z.enum(["keep", "other"]);
const mergeSchema = z.object({
  keepId: z.string().uuid(),
  removeId: z.string().uuid(),
  choices: z.object({
    name: side,
    prefix: side,
    logo: side,
    emails: z.enum(["union", "keep", "other"]),
    fiscal: side, // requiere factura, razón social, RFC y constancia
    address: side,
    contact: side,
    billing: side,
  }),
});

/**
 * Fusiona dos clientes: «keepId» es el registro que permanece y «removeId» desaparece.
 * Para cada grupo de datos, el usuario elige cuál versión queda como oficial.
 * Los proyectos, reportes, facturas y usuarios del cliente que desaparece pasan al que queda.
 * Los folios ya emitidos no cambian.
 */
export async function mergeClients(input: z.infer<typeof mergeSchema>): Promise<Result> {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos de fusión no válidos" };
  const { keepId, removeId, choices: c } = parsed.data;
  if (keepId === removeId) return { error: "Elige dos clientes distintos" };

  const [keep, other] = await Promise.all([
    prisma.client.findUnique({ where: { id: keepId }, include: { projects: { select: { id: true } }, registration: { select: { id: true } } } }),
    prisma.client.findUnique({ where: { id: removeId }, include: { projects: { select: { id: true } } } }),
  ]);
  if (!keep || !other) return { error: "Alguno de los clientes ya no existe" };

  // Con solicitudes de eliminación pendientes sobre alguno de los dos clientes no se fusiona
  const [reports, invoices] = await Promise.all([
    prisma.report.findMany({ where: { clientId: { in: [keepId, removeId] } }, select: { id: true } }),
    prisma.invoice.findMany({ where: { clientId: { in: [keepId, removeId] } }, select: { id: true } }),
  ]);
  const blocked = await prisma.deletionRequest.count({
    where: {
      status: "PENDIENTE",
      OR: [
        { targetType: "CLIENT", targetId: { in: [keepId, removeId] } },
        { targetType: "PROJECT", targetId: { in: [...keep.projects, ...other.projects].map((p) => p.id) } },
        { targetType: "REPORT", targetId: { in: reports.map((r) => r.id) } },
        { targetType: "INVOICE", targetId: { in: invoices.map((i) => i.id) } },
      ],
    },
  });
  if (blocked > 0) return { error: "Hay solicitudes de eliminación pendientes de estos clientes (o de sus proyectos, reportes o facturas). Resuélvelas en el Log y vuelve a intentar." };

  const pick = <T,>(s: "keep" | "other", a: T, b: T): T => (s === "keep" ? a : b);
  const mainEmails =
    c.emails === "union" ? uniqueEmails([...splitEmails(keep.mainEmails), ...splitEmails(other.mainEmails)]).join(",") : pick(c.emails, keep.mainEmails, other.mainEmails);

  const final = {
    companyName: pick(c.name, keep.companyName, other.companyName),
    folioPrefix: pick(c.prefix, keep.folioPrefix, other.folioPrefix),
    logoUrl: pick(c.logo, keep.logoUrl, other.logoUrl),
    mainEmails,
    // El consecutivo nunca baja: los folios nuevos siguen después de los de ambos clientes
    folioSeq: Math.max(keep.folioSeq, other.folioSeq),
    ...(c.fiscal === "keep"
      ? { requiresInvoice: keep.requiresInvoice, legalName: keep.legalName, rfc: keep.rfc, constanciaUrl: keep.constanciaUrl }
      : { requiresInvoice: other.requiresInvoice, legalName: other.legalName, rfc: other.rfc, constanciaUrl: other.constanciaUrl }),
    ...(c.address === "keep"
      ? { street: keep.street, colonia: keep.colonia, postalCode: keep.postalCode, city: keep.city, state: keep.state }
      : { street: other.street, colonia: other.colonia, postalCode: other.postalCode, city: other.city, state: other.state }),
    ...(c.contact === "keep"
      ? { contactName: keep.contactName, contactLastName: keep.contactLastName, contactPhone: keep.contactPhone, contactEmail: keep.contactEmail }
      : { contactName: other.contactName, contactLastName: other.contactLastName, contactPhone: other.contactPhone, contactEmail: other.contactEmail }),
    ...(c.billing === "keep"
      ? { billingName: keep.billingName, billingLastName: keep.billingLastName, billingPhone: keep.billingPhone, billingEmail: keep.billingEmail }
      : { billingName: other.billingName, billingLastName: other.billingLastName, billingPhone: other.billingPhone, billingEmail: other.billingEmail }),
  };

  const moved = { projects: other.projects.length, reports: 0, invoices: 0 };
  try {
    await prisma.$transaction(async (tx) => {
      moved.projects = (await tx.project.updateMany({ where: { clientId: removeId }, data: { clientId: keepId } })).count;
      moved.reports = (await tx.report.updateMany({ where: { clientId: removeId }, data: { clientId: keepId } })).count;
      moved.invoices = (await tx.invoice.updateMany({ where: { clientId: removeId }, data: { clientId: keepId } })).count;
      await tx.task.updateMany({ where: { clientId: removeId }, data: { clientId: keepId } }); // tareas del panel de tareas

      // Usuarios cliente: pasan al que queda (si ya tenían acceso a ambos, solo se conserva uno)
      const links = await tx.clientUser.findMany({ where: { clientId: removeId } });
      for (const l of links) {
        const has = await tx.clientUser.findUnique({ where: { userId_clientId: { userId: l.userId, clientId: keepId } } });
        if (!has) await tx.clientUser.create({ data: { userId: l.userId, clientId: keepId } });
      }
      // El registro público del cliente que desaparece se conserva ligado al que queda (solo puede haber uno)
      if (!keep.registration) await tx.clientRegistration.updateMany({ where: { clientId: removeId }, data: { clientId: keepId } });

      await tx.client.delete({ where: { id: removeId } }); // libera el prefijo por si se eligió el del otro cliente
      await tx.client.update({ where: { id: keepId }, data: final });
      await tx.auditLog.create({
        data: {
          userId: me.id,
          action: "MERGED_CLIENTS",
          details: auditDetails({
            kept: { id: keepId, name: keep.companyName, prefix: keep.folioPrefix },
            removed: { id: removeId, name: other.companyName, prefix: other.folioPrefix },
            result: { name: final.companyName, prefix: final.folioPrefix },
            choices: c,
            moved,
          }),
        },
      });
    });
  } catch (e) {
    console.error("[fusión] error:", e);
    return { error: "No se pudo fusionar. Revisa que no haya cambios en curso e intenta de nuevo." };
  }

  // Archivos que ya no usa ningún cliente
  const keepKeys = new Set([final.logoUrl, final.constanciaUrl].filter(Boolean));
  for (const k of [keep.logoUrl, keep.constanciaUrl, other.logoUrl, other.constanciaUrl]) {
    if (k && !keepKeys.has(k)) await deleteObject(k).catch(() => {});
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  revalidatePath("/facturas");
  revalidatePath("/eliminaciones");
  return { ok: true };
}
