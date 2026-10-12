"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { allowAction, overLimit } from "@/lib/rate-limit";
import { parseClientData, validateConstancia } from "@/lib/client-data";
import { validateLogo, readLogo311 } from "@/lib/branding";
import { putObject, getObject, deleteObject } from "@/lib/storage";
import { registroActivo, setRegistroActivo, registroNotifyEmail } from "@/lib/registro";
import { getBaseUrl } from "@/lib/base-url";
import { sendMail } from "@/lib/mailer";
import { registroNuevoEmail, registroConfirmacionEmail } from "@/lib/email-templates";

type State = { error?: string; ok?: boolean } | undefined;

const MAX_PENDING = 200; // tope de registros sin revisar: evita que alguien llene la base con envíos falsos
const quiet = (key: string | null | undefined) => (key ? deleteObject(key).catch(() => {}) : Promise.resolve());

/** Envío del formulario público de registro (no requiere sesión). */
export async function submitRegistration(_p: State, fd: FormData): Promise<State> {
  if (!(await registroActivo())) return { error: "El registro no está disponible por ahora. Escríbenos a admon@311consultores.com" };

  // Campo señuelo: lo llenan los programas automáticos, las personas no lo ven. Se responde "bien" sin guardar nada.
  if (String(fd.get("website") ?? "").trim() !== "") return { ok: true };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const HOUR = 60 * 60 * 1000;
  // Dos límites por IP: los registros guardados (10 por hora; una oficina puede registrar a varios clientes)
  // y los intentos en total (60 por hora; equivocarse al llenar el formulario no debe bloquear a nadie)
  if (overLimit(`registro-ok:${ip}`, 10, HOUR) || !allowAction(`registro-intentos:${ip}`, 60, HOUR)) {
    return { error: "Hemos recibido varios envíos desde tu conexión. Intenta más tarde o escríbenos a admon@311consultores.com" };
  }
  if ((await prisma.clientRegistration.count({ where: { status: "PENDIENTE" } })) >= MAX_PENDING) {
    return { error: "El registro está saturado por ahora. Escríbenos a admon@311consultores.com" };
  }
  if (fd.get("privacy") !== "on") return { error: "Debes aceptar el aviso de privacidad para continuar" };

  const parsed = parseClientData(fd);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  const id = randomUUID();
  const keys: string[] = [];
  try {
    let logoUrl: string | null = null;
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) {
      const v = await validateLogo(logo);
      if (!v.ok) return { error: v.error };
      logoUrl = `registros/${id}-logo-${randomUUID()}.${v.ext}`;
      keys.push(logoUrl);
      await putObject(logoUrl, v.buf, v.mime);
    }

    let constanciaUrl: string | null = null;
    const constancia = fd.get("constancia");
    if (d.requiresInvoice && constancia instanceof File && constancia.size > 0) {
      const v = await validateConstancia(constancia);
      if (!v.ok) {
        await Promise.all(keys.map(quiet));
        return { error: v.error };
      }
      constanciaUrl = `registros/${id}-constancia-${randomUUID()}.pdf`;
      keys.push(constanciaUrl);
      await putObject(constanciaUrl, v.buf, "application/pdf");
    }

    await prisma.clientRegistration.create({
      data: { id, ip: ip.slice(0, 64), ...d, logoUrl, constanciaUrl },
    });
  } catch (e) {
    console.error("[registro] error:", e);
    await Promise.all(keys.map(quiet));
    return { error: "No se pudo guardar tu registro. Intenta de nuevo en unos minutos." };
  }

  allowAction(`registro-ok:${ip}`, 10, HOUR); // cuenta solo los registros guardados

  // Avisos por correo: si fallan, el registro ya quedó guardado
  try {
    const logo311 = await readLogo311();
    const inline = logo311
      ? [{ cid: "logo311", content: logo311.data, contentType: logo311.contentType, filename: `logo.${logo311.format}` }]
      : undefined;
    const base = await getBaseUrl();
    await sendMail({
      to: [registroNotifyEmail()],
      ...registroNuevoEmail({
        companyName: d.companyName, contactName: d.contactName, contactEmail: d.contactEmail,
        requiresInvoice: d.requiresInvoice, link: `${base}/registros/${id}`, withLogo: !!logo311,
      }),
      inline,
    });
    await sendMail({
      to: [d.contactEmail],
      ...registroConfirmacionEmail({ contactName: d.contactName, companyName: d.companyName, withLogo: !!logo311 }),
      inline,
    });
  } catch (e) {
    console.error("[registro] no se pudieron enviar los avisos:", e);
  }
  return { ok: true };
}

/** Admin: activa o desactiva el enlace público. */
export async function toggleRegistroLink(active: boolean) {
  await requireUser(["ADMIN"]);
  await setRegistroActivo(active);
  revalidatePath("/registros");
  revalidatePath("/registro");
}

/** Aprueba un registro: crea el cliente en el catálogo con los datos (ya revisados y editados). */
export async function approveRegistration(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) return { error: "Registro no válido" };
  const reg = await prisma.clientRegistration.findUnique({ where: { id: id.data } });
  if (!reg || reg.status !== "PENDIENTE") return { error: "Este registro ya fue atendido" };

  const parsed = parseClientData(fd);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  const prefix = String(fd.get("folioPrefix") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(prefix)) return { error: "El prefijo de folio debe tener de 2 a 6 letras o números" };
  const taken = await prisma.client.findUnique({ where: { folioPrefix: prefix }, select: { companyName: true } });
  if (taken) return { error: `El prefijo ${prefix} ya lo usa «${taken.companyName}». Ajústalo.` };

  // El logo del registro se copia a la carpeta de logos de clientes; la constancia solo se conserva si requiere factura
  let logoUrl: string | null = null;
  if (reg.logoUrl) {
    try {
      const ext = reg.logoUrl.endsWith(".png") ? "png" : "jpg";
      logoUrl = `branding/client-${randomUUID()}.${ext}`;
      await putObject(logoUrl, await getObject(reg.logoUrl), ext === "png" ? "image/png" : "image/jpeg");
    } catch {
      logoUrl = null;
    }
  }
  const keepConstancia = d.requiresInvoice ? reg.constanciaUrl : null;

  try {
    await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: { ...d, folioPrefix: prefix, mainEmails: d.contactEmail, logoUrl, constanciaUrl: keepConstancia },
      });
      await tx.clientRegistration.update({
        where: { id: reg.id },
        data: {
          ...d, status: "APROBADO", clientId: client.id, reviewedById: user.id, reviewedAt: new Date(),
          logoUrl: null, constanciaUrl: null, // los archivos pasaron al cliente
        },
      });
    });
  } catch (e) {
    await quiet(logoUrl);
    console.error("[registro] aprobación:", e);
    return { error: "No se pudo aprobar el registro. Revisa que el nombre y el prefijo no estén repetidos." };
  }
  await quiet(reg.logoUrl);
  if (!d.requiresInvoice) await quiet(reg.constanciaUrl);

  revalidatePath("/registros");
  revalidatePath("/clientes");
  return { ok: true };
}

/** Rechaza un registro y borra los archivos que subió. */
export async function rejectRegistration(registrationId: string, reason: string): Promise<State> {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const reg = await prisma.clientRegistration.findUnique({ where: { id: registrationId } });
  if (!reg || reg.status !== "PENDIENTE") return { error: "Este registro ya fue atendido" };
  await prisma.clientRegistration.update({
    where: { id: reg.id },
    data: {
      status: "RECHAZADO", reviewedById: user.id, reviewedAt: new Date(),
      rejectionReason: reason.trim().slice(0, 500) || null, logoUrl: null, constanciaUrl: null,
    },
  });
  await Promise.all([quiet(reg.logoUrl), quiet(reg.constanciaUrl)]);
  revalidatePath("/registros");
  return { ok: true };
}

/** Edita los datos fiscales y de contacto de un cliente (Admin y Editor). */
export async function updateClientProfile(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN", "EDITOR"]);
  const clientId = z.string().uuid().safeParse(fd.get("clientId"));
  if (!clientId.success) return { error: "Cliente no válido" };
  const client = await prisma.client.findUnique({ where: { id: clientId.data }, select: { constanciaUrl: true } });
  if (!client) return { error: "El cliente no existe" };

  const parsed = parseClientData(fd);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  let constanciaUrl: string | undefined;
  const file = fd.get("constancia");
  if (d.requiresInvoice && file instanceof File && file.size > 0) {
    const v = await validateConstancia(file);
    if (!v.ok) return { error: v.error };
    constanciaUrl = `clientes/${clientId.data}-constancia-${randomUUID()}.pdf`;
    await putObject(constanciaUrl, v.buf, "application/pdf");
  }

  await prisma.client.update({ where: { id: clientId.data }, data: { ...d, ...(constanciaUrl ? { constanciaUrl } : {}) } });
  if (constanciaUrl) await quiet(client.constanciaUrl); // reemplaza la anterior
  revalidatePath("/clientes");
  return { ok: true };
}
