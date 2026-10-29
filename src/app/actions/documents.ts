"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { validateLogo } from "@/lib/branding";
import { deleteObject, putObject } from "@/lib/storage";
import { mailConfigured, mailDryRun, sendMail } from "@/lib/mailer";
import { isValidIsoDate, parseMoney, todayMx } from "@/lib/finance";
import { empresaOf, getDocsConfig, missingEmpresa, saveDocsConfig } from "@/lib/docs/config";
import { renderPdf } from "@/lib/docs/render";
import { acuerdoFileName, contratoFileName, reciboFileName, SERVICIOS_BASE } from "@/lib/docs/templates";
import { invalidEmails, parseEmails } from "@/lib/docs/text";
import { parseDocData, type AcuerdoData, type ContratoData, type DocsConfig, type ReciboData } from "@/lib/docs/types";

type State = { error?: string; ok?: boolean } | undefined;
const STAFF = ["ADMIN", "EDITOR"] as const;

const refresh = (id?: string) => {
  revalidatePath("/documentos");
  if (id) revalidatePath(`/documentos/${id}`);
};

const dateField = z.string().refine(isValidIsoDate, "Indica la fecha");
const txt = (max: number, msg: string, min = 1) => z.string().trim().min(min, msg).max(max, "El texto es demasiado largo");

// ---------- Configuración (solo Administrador) ----------
export async function saveDocsConfigAction(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      razonSocial: txt(200, "Escribe la razón social de la empresa"),
      domicilio: txt(400, "Escribe el domicilio de la empresa"),
      rfc: z.string().trim().toUpperCase().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, "El RFC no es válido (por ejemplo TAS2408225DA)"),
      repNombre: txt(150, "Escribe el nombre del representante"),
      repDomicilio: txt(300, "Escribe el domicilio del representante"),
      repIne: txt(30, "Escribe el número de INE del representante"),
      ciudad: txt(120, "Escribe la ciudad (por ejemplo Mérida, Yucatán, México)"),
      bcc: z.string().trim().max(191),
      emailRescision: z.string().trim().max(191),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const bcc = d.bcc ? parseEmails(d.bcc) : [];
  if (invalidEmails(bcc).length) return { error: "El correo de copia oculta no es válido" };
  if (d.emailRescision && invalidEmails([d.emailRescision.toLowerCase()]).length) return { error: "El correo para notificar la rescisión no es válido" };

  const cargos = String(fd.get("cargos") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (cargos.length === 0) return { error: "Agrega al menos un cargo para quien firma por la empresa" };

  const old = await getDocsConfig();
  const names = fd.getAll("pNombre").map(String);
  const olds = fd.getAll("pFirma").map(String);
  const keeps = fd.getAll("pKeep").map(String);
  const files = fd.getAll("pFile");
  const recibe: DocsConfig["recibe"] = [];
  for (let i = 0; i < names.length; i++) {
    const nombre = names[i].trim();
    if (!nombre) continue;
    let firmaKey = keeps[i] === "1" && olds[i] ? olds[i] : null;
    const f = files[i];
    if (f instanceof File && f.size > 0) {
      const v = await validateLogo(f);
      if (!v.ok) return { error: v.error.replace("logo", "firma") };
      firmaKey = `firmas/${randomUUID()}.${v.ext}`;
      await putObject(firmaKey, v.buf, v.mime);
    }
    recibe.push({ nombre, firmaKey });
  }
  // Se borran las firmas que ya no se usan
  const still = new Set(recibe.map((r) => r.firmaKey).filter(Boolean));
  for (const r of old.recibe) if (r.firmaKey && !still.has(r.firmaKey)) await deleteObject(r.firmaKey).catch(() => {});

  await saveDocsConfig({ ...d, cargos, recibe, bcc: bcc.join(", ") });
  revalidatePath("/documentos/configuracion");
  revalidatePath("/documentos");
  return { ok: true };
}

// ---------- Acuerdo de confidencialidad ----------
async function ensureClient(id: string) {
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c) throw new Error("Elige un cliente");
  return c;
}

export async function saveAcuerdo(docId: string | null, _p: State, fd: FormData): Promise<State> {
  const user = await requireUser([...STAFF]);
  const parsed = z
    .object({
      clientId: z.string().uuid("Elige un cliente"),
      razon: txt(255, "Escribe la razón social del cliente"),
      clienteDomicilio: z.string().trim().max(400),
      repNombre: txt(150, "Escribe el nombre del representante legal"),
      repDomicilio: txt(300, "Escribe el domicilio del representante legal"),
      repCurp: z.string().trim().toUpperCase().length(18, "La CURP debe tener 18 caracteres"),
      repIne: z.string().trim().toUpperCase().min(5, "Escribe la clave de elector (INE)").max(20, "La clave de elector es demasiado larga"),
      repRol: z.string().trim().max(120),
      fecha: dateField,
      cargo: txt(120, "Elige el cargo de quien firma por la empresa"),
      meses: z.coerce.number().int().min(1, "La duración debe ser de al menos 1 mes").max(120, "La duración es demasiado larga"),
      anios: z.coerce.number().int().min(0, "Los años adicionales no pueden ser negativos").max(30, "Los años adicionales son demasiados"),
      pena: z.string(),
      extraTitulo: z.string().trim().max(150),
      extraTexto: z.string().trim().max(5000, "La cláusula adicional es demasiado larga"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const pena = parseMoney(d.pena);
  if (pena === null) return { error: "La pena convencional debe ser un monto mayor a cero (por ejemplo 50000.00)" };

  const cfg = await getDocsConfig();
  const falta = missingEmpresa(empresaOf(cfg));
  if (falta.length) return { error: `Faltan datos de la empresa en Documentos › Configuración: ${falta.join(", ")}` };
  if (!cfg.cargos.includes(d.cargo)) return { error: "Elige un cargo de la lista" };

  let client;
  try {
    client = await ensureClient(d.clientId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const data: AcuerdoData = {
    kind: "ACUERDO", empresa: empresaOf(cfg), fecha: d.fecha,
    cliente: { razon: d.razon, domicilio: d.clienteDomicilio },
    rep: { nombre: d.repNombre, domicilio: d.repDomicilio, curp: d.repCurp, ine: d.repIne, rol: d.repRol || "Representante Legal" },
    cargoEmpresa: d.cargo, meses: d.meses, anios: d.anios, penaCents: pena,
    extra: d.extraTexto ? { titulo: d.extraTitulo, texto: d.extraTexto } : null,
  };
  const fileName = acuerdoFileName(client.companyName, d.fecha);

  const saved = await persist(docId, "ACUERDO", client.id, null, fileName, data, user.id);
  if ("error" in saved) return { error: saved.error };
  if (fd.get("saveRep") === "on") {
    await prisma.client.update({
      where: { id: client.id },
      data: { legalRepName: d.repNombre, legalRepAddress: d.repDomicilio, legalRepCurp: d.repCurp, legalRepIne: d.repIne, legalRepRole: d.repRol || null },
    });
  }
  refresh(saved.id);
  redirect(`/documentos/${saved.id}`);
}

// ---------- Contrato de prestación de servicios ----------
export async function saveContrato(docId: string | null, _p: State, fd: FormData): Promise<State> {
  const user = await requireUser([...STAFF]);
  const parsed = z
    .object({
      clientId: z.string().uuid("Elige un cliente"),
      razon: txt(255, "Escribe la razón social del cliente"),
      clienteDomicilio: z.string().trim().max(400),
      repNombre: txt(150, "Escribe el nombre del representante legal"),
      repDomicilio: txt(300, "Escribe el domicilio del representante legal"),
      repCurp: z.string().trim().toUpperCase().length(18, "La CURP debe tener 18 caracteres"),
      repIne: z.string().trim().toUpperCase().min(5, "Escribe la clave de elector (INE)").max(20, "La clave de elector es demasiado larga"),
      repRol: z.string().trim().max(120),
      fecha: dateField,
      cargo: txt(120, "Elige el cargo de quien firma por la empresa"),
      ramo: txt(120, "Escribe el ramo del cliente (por ejemplo ferretero)"),
      meses: z.coerce.number().int().min(1, "La duración debe ser de al menos 1 mes").max(120, "La duración es demasiado larga"),
      anios: z.coerce.number().int().min(0, "Los años de confidencialidad no pueden ser negativos").max(30, "Los años de confidencialidad son demasiados"),
      penalidadPct: z.coerce.number().int().min(1, "La penalidad debe ser de al menos 1%").max(100, "La penalidad no puede pasar de 100%"),
      prorrogaDias: z.coerce.number().int().min(0, "Los días de prórroga no pueden ser negativos").max(60, "Los días de prórroga son demasiados"),
      emailRescision: z.string().trim().toLowerCase().max(191),
      extraTitulo: z.string().trim().max(150),
      extraTexto: z.string().trim().max(5000, "La cláusula adicional es demasiado larga"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!d.emailRescision || invalidEmails([d.emailRescision]).length) return { error: "Escribe un correo válido para notificar la rescisión por falta de pago" };

  // Servicios: los del catálogo que se marcaron más los que se escribieron a mano
  const servicios = [
    ...SERVICIOS_BASE.filter((s) => fd.getAll("servicio").map(String).includes(s.id)).map((s) => s.text),
    ...fd.getAll("servicioExtra").map((s) => String(s).trim()).filter(Boolean).map((s) => (s.length > 600 ? "" : s)),
  ];
  if (servicios.some((s) => s === "")) return { error: "La descripción de un servicio es demasiado larga" };
  if (servicios.length === 0) return { error: "Elige o escribe al menos un servicio" };

  const meses = fd.getAll("pMes").map((s) => String(s).trim());
  const montos = fd.getAll("pMonto").map(String);
  const ivas = fd.getAll("pIva").map(String);
  const pagos: ContratoData["pagos"] = [];
  for (let i = 0; i < meses.length; i++) {
    if (!meses[i] && !montos[i]?.trim()) continue; // renglón vacío
    if (!meses[i]) return { error: "Escribe el mes de cada pago (por ejemplo Noviembre 2026)" };
    if (meses[i].length > 40) return { error: "El nombre del mes de un pago es demasiado largo" };
    const cents = parseMoney(montos[i] ?? "");
    if (cents === null) return { error: `El monto de ${meses[i]} debe ser mayor a cero (por ejemplo 22500.00)` };
    pagos.push({ mes: meses[i], cents, masIva: ivas[i] === "1" });
  }
  if (pagos.length === 0) return { error: "Agrega al menos un pago" };

  const cfg = await getDocsConfig();
  const falta = missingEmpresa(empresaOf(cfg));
  if (falta.length) return { error: `Faltan datos de la empresa en Documentos › Configuración: ${falta.join(", ")}` };
  if (!cfg.cargos.includes(d.cargo)) return { error: "Elige un cargo de la lista" };

  let client;
  try {
    client = await ensureClient(d.clientId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const data: ContratoData = {
    kind: "CONTRATO", empresa: empresaOf(cfg), fecha: d.fecha,
    cliente: { razon: d.razon, domicilio: d.clienteDomicilio },
    rep: { nombre: d.repNombre, domicilio: d.repDomicilio, curp: d.repCurp, ine: d.repIne, rol: d.repRol || "Representante Legal" },
    cargoEmpresa: d.cargo, ramo: d.ramo, servicios, pagos, meses: d.meses, anios: d.anios,
    penalidadPct: d.penalidadPct, prorrogaDias: d.prorrogaDias, emailRescision: d.emailRescision,
    extra: d.extraTexto ? { titulo: d.extraTitulo, texto: d.extraTexto } : null,
  };

  const saved = await persist(docId, "CONTRATO", client.id, null, contratoFileName(client.companyName, d.fecha), data, user.id);
  if ("error" in saved) return { error: saved.error };
  if (fd.get("saveRep") === "on") {
    await prisma.client.update({
      where: { id: client.id },
      data: { legalRepName: d.repNombre, legalRepAddress: d.repDomicilio, legalRepCurp: d.repCurp, legalRepIne: d.repIne, legalRepRole: d.repRol || null },
    });
  }
  refresh(saved.id);
  redirect(`/documentos/${saved.id}`);
}

// ---------- Recibo de pago ----------
export async function saveRecibo(docId: string | null, _p: State, fd: FormData): Promise<State> {
  const user = await requireUser([...STAFF]);
  const parsed = z
    .object({
      clientId: z.string().uuid("Elige un cliente"),
      clienteNombre: z.string().trim().max(150),
      clienteEmpresa: txt(255, "Escribe el nombre del cliente"),
      fecha: dateField,
      recibe: txt(150, "Elige quién confirma de recibido"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const descs = fd.getAll("cDesc").map((s) => String(s).trim());
  const montos = fd.getAll("cMonto").map(String);
  const conceptos: ReciboData["conceptos"] = [];
  for (let i = 0; i < descs.length; i++) {
    if (!descs[i] && !montos[i]?.trim()) continue; // renglón vacío
    if (!descs[i]) return { error: "Escribe la descripción de cada concepto" };
    if (descs[i].length > 300) return { error: "La descripción de un concepto es demasiado larga" };
    const cents = parseMoney(montos[i] ?? "");
    if (cents === null) return { error: `El monto de «${descs[i]}» debe ser mayor a cero (por ejemplo 7500.00)` };
    conceptos.push({ desc: descs[i], cents });
  }
  if (conceptos.length === 0) return { error: "Agrega al menos un concepto con su monto" };

  const cfg = await getDocsConfig();
  const persona = cfg.recibe.find((p) => p.nombre === d.recibe);
  if (!persona) return { error: "Elige a una persona de la lista de «Confirma de recibido» (se administra en Documentos › Configuración)" };

  let client;
  try {
    client = await ensureClient(d.clientId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const data: ReciboData = {
    kind: "RECIBO", fecha: d.fecha, clienteNombre: d.clienteNombre, clienteEmpresa: d.clienteEmpresa, conceptos, recibe: persona.nombre,
    firmaKey: fd.get("incluirFirma") === "on" ? persona.firmaKey ?? null : null,
  };

  const saved = await persist(docId, "RECIBO", client.id, "folio", reciboFileName("{FOLIO}", client.companyName, d.fecha), data, user.id);
  if ("error" in saved) return { error: saved.error };
  refresh(saved.id);
  redirect(`/documentos/${saved.id}`);
}

/** Crea o actualiza el documento. El recibo recibe su folio (prefijo del cliente + consecutivo) al crearse y lo conserva al editarse. */
async function persist(docId: string | null, kind: "RECIBO" | "ACUERDO" | "CONTRATO", clientId: string, folio: "folio" | null, fileName: string, data: object, userId: string): Promise<{ id: string } | { error: string }> {
  if (docId) {
    const cur = await prisma.document.findUnique({ where: { id: docId } });
    if (!cur) return { error: "El documento no existe" };
    if (cur.status !== "BORRADOR") return { error: "Un documento enviado ya no se puede editar. Usa «Duplicar» para hacer una nueva versión." };
    if (cur.kind === "RECIBO" && cur.clientId !== clientId) return { error: "El cliente de un recibo no se puede cambiar (el folio depende de él). Crea un recibo nuevo." };
    await prisma.document.update({ where: { id: docId }, data: { clientId, fileName: fileName.replace("{FOLIO}", cur.folio ?? ""), data: JSON.stringify(data) } });
    return { id: docId };
  }
  const doc = await prisma.$transaction(async (tx) => {
    let f: string | null = null;
    if (folio) {
      const c = await tx.client.update({ where: { id: clientId }, data: { receiptSeq: { increment: 1 } }, select: { folioPrefix: true, receiptSeq: true } });
      f = `${c.folioPrefix}${String(c.receiptSeq).padStart(2, "0")}`;
    }
    return tx.document.create({
      data: { kind, clientId, folio: f, fileName: fileName.replace("{FOLIO}", f ?? ""), data: JSON.stringify(data), createdById: userId },
    });
  });
  return { id: doc.id };
}

// ---------- Duplicar y eliminar borradores ----------
export async function duplicateDocument(id: string): Promise<{ error?: string }> {
  const user = await requireUser([...STAFF]);
  const src = await prisma.document.findUnique({ where: { id } });
  if (!src) return { error: "El documento no existe" };
  const data = parseDocData(src.data);
  const today = todayMx();
  let created: { id: string };
  if (src.kind === "RECIBO") {
    created = await prisma.$transaction(async (tx) => {
      const c = await tx.client.update({ where: { id: src.clientId }, data: { receiptSeq: { increment: 1 } }, select: { folioPrefix: true, receiptSeq: true, companyName: true } });
      const folio = `${c.folioPrefix}${String(c.receiptSeq).padStart(2, "0")}`;
      const next = { ...(data as ReciboData), fecha: today };
      return tx.document.create({ data: { kind: "RECIBO", clientId: src.clientId, folio, fileName: reciboFileName(folio, c.companyName, today), data: JSON.stringify(next), createdById: user.id } });
    });
  } else {
    const next = { ...data, fecha: today };
    const c = await prisma.client.findUniqueOrThrow({ where: { id: src.clientId }, select: { companyName: true } });
    created = await prisma.document.create({ data: { kind: src.kind, clientId: src.clientId, fileName: (src.kind === "CONTRATO" ? contratoFileName : acuerdoFileName)(c.companyName, today), data: JSON.stringify(next), createdById: user.id } });
  }
  refresh();
  redirect(`/documentos/${created.id}`);
}

export async function deleteDraft(id: string): Promise<{ error?: string }> {
  await requireUser(["ADMIN"]);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return { error: "El documento no existe" };
  if (doc.status !== "BORRADOR") return { error: "Solo se pueden eliminar borradores que nunca se enviaron" };
  await prisma.document.delete({ where: { id } });
  refresh();
  redirect("/documentos");
}

// ---------- Envío por correo ----------
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendDocument(id: string, _p: State, fd: FormData): Promise<State> {
  const user = await requireUser([...STAFF]);
  if (fd.get("confirmed") !== "on") return { error: "Marca «Lo leí y está correcto» para poder enviar el documento" };
  const to = parseEmails(String(fd.get("to") ?? ""));
  if (to.length === 0) return { error: "Escribe al menos un destinatario" };
  const bad = invalidEmails(to);
  if (bad.length) return { error: `Correo no válido: ${bad.join(", ")}` };
  const subject = String(fd.get("subject") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (subject.length < 3 || subject.length > 255) return { error: "Escribe el asunto del correo" };
  if (body.length < 3) return { error: "Escribe el mensaje del correo" };
  if (!mailConfigured() && !mailDryRun()) return { error: "El correo (Gmail) no está configurado en el servidor" };

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return { error: "El documento no existe" };
  const cfg = await getDocsConfig();
  const bcc = parseEmails(cfg.bcc).filter((e) => !to.includes(e));

  try {
    const pdf = await renderPdf(doc);
    await sendMail({
      to, bcc, subject,
      text: body,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">${esc(body).replace(/\n/g, "<br>")}</div>`,
      attachment: { filename: `${doc.fileName}.pdf`, content: pdf, contentType: "application/pdf" },
    });
  } catch (e) {
    console.error("[documentos] envío fallido", e);
    return { error: "No se pudo enviar el correo. Revisa la conexión de Gmail e inténtalo de nuevo." };
  }
  await prisma.$transaction([
    prisma.documentSend.create({ data: { documentId: id, sentById: user.id, toEmails: to.join(", "), bccEmails: bcc.join(", ") || null, subject, body } }),
    prisma.document.update({ where: { id }, data: { status: "ENVIADO", sentAt: new Date() } }),
  ]);
  refresh(id);
  return { ok: true };
}
