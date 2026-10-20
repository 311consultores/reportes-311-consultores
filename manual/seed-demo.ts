/**
 * Prepara una base de datos LOCAL con datos de ejemplo inventados para tomar las capturas del manual.
 * Ejecutar desde la raiz del proyecto:  npx tsx manual/seed-demo.ts
 * ADVERTENCIA: borra clientes, reportes y registros de la base local. Se niega a correr si no es localhost.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, type ReportStatus } from "@prisma/client";
import { putObject } from "../src/lib/storage";

const prisma = new PrismaClient();
const A = (f: string) => fs.readFileSync(path.join(__dirname, "assets", f));
const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

async function main() {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Solo se puede ejecutar contra una base de datos local");
  }
  const uploads = path.resolve(process.env.UPLOADS_DIR ?? ".uploads");
  if (!uploads.includes(".uploads")) throw new Error("Carpeta de archivos inesperada: " + uploads);

  // 1) Limpieza
  // panel de tareas (Evolutivo 7)
  await prisma.noteShare.deleteMany(); // baúl y suscripciones (Evolutivo 8)
  await prisma.noteLabelLink.deleteMany();
  await prisma.noteItem.deleteMany();
  await prisma.noteLabel.deleteMany();
  await prisma.note.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.subtask.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.taskAttachment.deleteMany();
  await prisma.taskMessage.deleteMany();
  await prisma.taskEvent.deleteMany();
  await prisma.taskResource.deleteMany();
  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany();
  await prisma.ledgerEntry.deleteMany(); // finanzas (Evolutivo 4)
  await prisma.expense.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.deletionRequest.deleteMany();
  await prisma.clientRegistration.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.taskEvidence.deleteMany();
  await prisma.reportTask.deleteMany();
  await prisma.report.deleteMany();
  await prisma.clientUser.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.user.deleteMany({ where: { role: { in: ["CLIENTE", "TEAM_311"] } } });
  await prisma.appSetting.deleteMany({ where: { key: { in: ["logo311", "reparto_porcentajes", "datos_bancarios", "facturas_alerta_fecha"] } } });
  fs.rmSync(uploads, { recursive: true, force: true });

  // 2) Usuarios de ejemplo
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  await prisma.user.update({ where: { id: admin.id }, data: { name: "Carlos Administrador", theme: "light" } });
  const editorPass = process.env.SEED_EDITOR_PASSWORD;
  if (!editorPass) throw new Error("Define SEED_EDITOR_PASSWORD en .env");
  const editor = await prisma.user.upsert({
    where: { email: "editor@311consultores.com" },
    update: { name: "Mariana Asistente", passwordHash: await bcrypt.hash(editorPass, 10), theme: "light", active: true },
    create: { name: "Mariana Asistente", email: "editor@311consultores.com", passwordHash: await bcrypt.hash(editorPass, 10), role: "EDITOR", theme: "light" },
  });

  // Foto y cumpleaños de la asistente (el Editor ahora tiene «Mi perfil»)
  const kEditorPhoto = `perfiles/${randomUUID()}.jpg`;
  await putObject(kEditorPhoto, A("persona-mariana.jpg"), "image/jpeg");
  await prisma.user.update({ where: { id: editor.id }, data: { photoUrl: kEditorPhoto, birthday: "08-12" } });

  // 2b) Usuarios TEAM 311 de ejemplo (con y sin foto)
  const teamPass = await bcrypt.hash("TeamDemo2026", 10);
  const person = async (name: string, email: string, photo: string | null, birthday: string, role: "TEAM_311" | "PROJECT_311" = "TEAM_311") => {
    let photoUrl: string | null = null;
    if (photo) {
      photoUrl = `perfiles/${randomUUID()}.jpg`;
      await putObject(photoUrl, A(photo), "image/jpeg");
    }
    return prisma.user.create({ data: { name, email, passwordHash: teamPass, role, theme: "light", photoUrl, birthday } });
  };
  const ana = await person("Ana Pérez", "ana.perez@ejemplo.test", "persona-ana.jpg", "03-15");
  const luis = await person("Luis Gómez", "luis.gomez@ejemplo.test", "persona-luis.jpg", "09-02");
  const sofia = await person("Sofía Ríos", "sofia.rios@ejemplo.test", null, "11-27");
  await person("Paula Proyectos", "paula.proyectos@ejemplo.test", null, "05-20", "PROJECT_311"); // usuario PROJECT 311 de ejemplo (manual del PROJECT 311)

  // 3) Logos
  const k311 = `branding/311-${randomUUID()}.png`;
  await putObject(k311, A("logo-311.png"), "image/png");
  await prisma.appSetting.create({ data: { key: "logo311", value: k311 } });
  const kHrz = `branding/client-${randomUUID()}.png`;
  await putObject(kHrz, A("logo-horizonte.png"), "image/png");
  const kCsa = `branding/client-${randomUUID()}.png`;
  await putObject(kCsa, A("logo-aurora.png"), "image/png");

  // 4) Clientes y proyectos
  const hrzId = randomUUID();
  const kConst = `clientes/${hrzId}-constancia-${randomUUID()}.pdf`;
  await putObject(kConst, A("constancia-ejemplo.pdf"), "application/pdf");
  const hrz = await prisma.client.create({
    data: {
      id: hrzId, companyName: "Constructora Horizonte", folioPrefix: "HRZ", mainEmails: "roberto.salinas@horizonte.example",
      logoUrl: kHrz, folioSeq: 3, requiresInvoice: true, legalName: "Constructora Horizonte S.A. de C.V.", rfc: "CHO120315AB7",
      street: "Av. Insurgentes Sur 1234", colonia: "Del Valle", postalCode: "03100", city: "Ciudad de México", state: "Ciudad de México",
      constanciaUrl: kConst, contactName: "Roberto", contactLastName: "Salinas", contactPhone: "5512345678", contactEmail: "roberto.salinas@horizonte.example",
      billingName: "Laura", billingLastName: "Méndez", billingPhone: "5587654321", billingEmail: "pagos@horizonte.example",
    },
  });
  const csa = await prisma.client.create({
    data: {
      companyName: "Clínica Santa Aurora", folioPrefix: "CSA", mainEmails: "direccion@aurora.example", logoUrl: kCsa, folioSeq: 2,
      requiresInvoice: false, contactName: "Patricia", contactLastName: "Vega", contactPhone: "3398765432", contactEmail: "direccion@aurora.example",
      billingName: "Jorge", billingLastName: "Ibarra", billingPhone: "3311223344", billingEmail: "administracion@aurora.example",
    },
  });
  const torre = await prisma.project.create({ data: { clientId: hrz.id, projectName: "Torre Norte", projectEmails: "roberto.salinas@horizonte.example,coordinador@horizonte.example", responsibleName: "Fernando", responsibleLastName: "Aguilar" } });
  await prisma.project.create({ data: { clientId: hrz.id, projectName: "Plaza Comercial Sur", projectEmails: "plaza@horizonte.example", responsibleName: "Elena", responsibleLastName: "Cruz" } });
  const expedientes = await prisma.project.create({ data: { clientId: csa.id, projectName: "Modernización de expedientes", projectEmails: "direccion@aurora.example,sistemas@aurora.example", responsibleName: "Rosa", responsibleLastName: "Vega" } });
  // Cliente repetido (mismo RFC que Horizonte): sirve para mostrar la fusión de clientes
  await prisma.client.create({
    data: {
      companyName: "Horizonte Construcciones", folioPrefix: "HZC", mainEmails: "contacto@horizonte.example", requiresInvoice: true,
      legalName: "Horizonte Construcciones S.A. de C.V.", rfc: "CHO120315AB7", street: "Av. Insurgentes Sur 1234", colonia: "Del Valle",
      postalCode: "03100", city: "Ciudad de México", state: "Ciudad de México", contactName: "Roberto", contactLastName: "Salinas",
      contactPhone: "5512345678", contactEmail: "contacto@horizonte.example", billingName: "Laura", billingLastName: "Méndez",
      billingPhone: "5587654321", billingEmail: "pagos@horizonte.example",
    },
  });
  const plaza = await prisma.project.findFirstOrThrow({ where: { clientId: hrz.id, projectName: "Plaza Comercial Sur" } });
  await prisma.userProject.createMany({
    data: [
      { userId: ana.id, projectId: torre.id }, { userId: ana.id, projectId: plaza.id },
      { userId: luis.id, projectId: torre.id }, { userId: luis.id, projectId: expedientes.id },
      { userId: sofia.id, projectId: expedientes.id },
    ],
  });

  // 5) Reportes
  type T = { title: string; html: string; photos: string[]; executedAt?: string };
  async function report(folio: string, clientId: string, projectId: string, status: ReportStatus, start: string, end: string, created: string, tasks: T[], rejection?: string) {
    const r = await prisma.report.create({
      data: {
        folio, clientId, projectId, status, startDate: d(start), endDate: d(end), createdAt: d(created), createdById: editor.id,
        consultants: JSON.stringify([ana.name, luis.name]), consultantIds: JSON.stringify([ana.id, luis.id]), rejectionComment: rejection ?? null,
      },
    });
    await prisma.auditLog.create({ data: { reportId: r.id, userId: editor.id, action: "CREATED_REPORT", createdAt: d(created) } });
    let n = 0;
    for (const t of tasks) {
      n++;
      const task = await prisma.reportTask.create({
        data: { reportId: r.id, sequentialNum: n, title: t.title, descriptionHtml: t.html, executedAt: t.executedAt ?? null, createdById: editor.id, createdAt: d(created) },
      });
      for (const p of t.photos) {
        const key = `reports/${r.id}/${task.id}-${randomUUID()}.jpg`;
        await putObject(key, A(p), "image/jpeg");
        await prisma.taskEvidence.create({ data: { taskId: task.id, url: key, type: "IMAGE" } });
      }
      await prisma.auditLog.create({ data: { reportId: r.id, userId: editor.id, action: `ADDED_TASK_${n}`, createdAt: d(created) } });
    }
    const flow: Record<ReportStatus, [ReportStatus, string][]> = {
      EN_PROCESO: [],
      TERMINADO: [["TERMINADO", editor.id]],
      RECHAZADO: [["TERMINADO", editor.id], ["RECHAZADO", admin.id]],
      APROBADO: [["TERMINADO", editor.id], ["APROBADO", admin.id]],
      ENVIADO: [["TERMINADO", editor.id], ["APROBADO", admin.id], ["ENVIADO", editor.id]],
    };
    for (const [s, uid] of flow[status]) {
      await prisma.auditLog.create({ data: { reportId: r.id, userId: uid, action: `STATUS_CHANGE_${s}`, createdAt: d(end) } });
    }
    return r;
  }

  const p1 = `<p>Se realizó la <strong>reunión de arranque</strong> con el equipo directivo del cliente.</p><ul><li>Se presentó el plan de trabajo</li><li>Se acordaron las fechas de entrega</li></ul>`;
  const p2 = `<p>Recorrido por las instalaciones para levantar el estado actual de los procesos.</p><ol><li>Revisión de documentos</li><li>Entrevistas con los responsables</li></ol>`;
  const p3 = `<p>Se entregó el <em>reporte de avances</em> de la semana y se recibieron comentarios.</p>`;

  await report("HRZ001220926", hrz.id, torre.id, "ENVIADO", "2026-09-14", "2026-09-18", "2026-09-22", [{ title: "Reunión de arranque", html: p1, photos: ["foto-1.jpg"] }]);
  await report("HRZ002290926", hrz.id, torre.id, "APROBADO", "2026-09-21", "2026-09-25", "2026-09-29", [{ title: "Recorrido en obra", html: p2, photos: ["foto-2.jpg"] }, { title: "Entrega de avances", html: p3, photos: ["foto-3.jpg"] }]);
  await report("CSA001071026", csa.id, expedientes.id, "RECHAZADO", "2026-09-28", "2026-10-02", "2026-10-07", [{ title: "Capacitación al personal", html: p1, photos: [] }], "Falta la evidencia de la actividad 1. Por favor agrega una foto o lista de asistencia.");
  const csa2 = await report("CSA002091026", csa.id, expedientes.id, "TERMINADO", "2026-10-05", "2026-10-09", "2026-10-09", [{ title: "Revisión de expedientes", html: p2, photos: ["foto-2.jpg"] }]);
  // Solicitud de edición pendiente de un TEAM 311 (la atiende Admin o Editor)
  await prisma.editRequest.create({
    data: { reportId: csa2.id, requestedById: luis.id, reason: "Falta anexar el listado de asistencia de la revisión de expedientes.", createdAt: d("2026-10-14") },
  });
  await report("HRZ003091026", hrz.id, torre.id, "EN_PROCESO", "2026-10-05", "2026-10-09", "2026-10-09", [
    { title: "Reunión de arranque", html: p1, photos: ["foto-1.jpg", "foto-2.jpg"], executedAt: "2026-10-05 10:00" },
    { title: "Recorrido en obra", html: p2, photos: ["foto-2.jpg"], executedAt: "2026-10-06 16:30" },
    { title: "", html: "", photos: [] },
  ]);

  // 5a) Tareas de ejemplo (panel de tareas)
  const H = 3600e3;
  const mkTask = async (
    title: string, clientId: string, projectId: string, who: string[], status: "PENDIENTE" | "EN_PROCESO" | "PARA_REVISAR" | "TERMINADA",
    dueInH: number, html: string, resources: { title: string; url: string }[] = [], extra: Record<string, unknown> = {},
  ) =>
    prisma.task.create({
      data: {
        title, clientId, projectId, status, descriptionHtml: html, dueAt: new Date(Date.now() + dueInH * H), createdById: editor.id, createdAt: new Date(Date.now() - 20 * H),
        assignees: { create: who.map((userId) => ({ userId })) },
        resources: { create: resources.map((r, position) => ({ ...r, position })) },
        events: { create: [{ userId: editor.id, kind: "CREATED", createdAt: new Date(Date.now() - 20 * H) }] },
        ...extra,
      },
    });
  const prep = await mkTask("Preparar presentación de avances", hrz.id, torre.id, [ana.id], "PENDIENTE", 30,
    "<p>Armar la presentación del avance de septiembre.</p><ul><li>Resumen de actividades</li><li>Fotos del recorrido</li></ul>",
    [{ title: "Carpeta del cliente", url: "https://drive.google.com/drive/folders/ejemplo-horizonte" }, { title: "Plantilla de presentación", url: "https://drive.google.com/file/d/ejemplo-plantilla" }]);
  await mkTask("Levantar requerimientos de expedientes", csa.id, expedientes.id, [luis.id, sofia.id], "EN_PROCESO", 8, "<p>Entrevistar a las áreas y documentar los requerimientos.</p>");
  await mkTask("Actualizar inventario de equipos", csa.id, expedientes.id, [sofia.id], "PENDIENTE", -26, "<p>Revisar el inventario de computadoras del área médica.</p>");
  const ready = await mkTask("Entregar reporte de recorrido", hrz.id, torre.id, [ana.id], "PARA_REVISAR", 20,
    "<p>Entregar el reporte con fotos del recorrido por la obra.</p>", [{ title: "Fotos del recorrido", url: "https://drive.google.com/drive/folders/ejemplo-fotos" }], { readyAt: new Date() });
  await prisma.taskEvent.createMany({
    data: [
      { taskId: ready.id, userId: ana.id, kind: "MOVED", note: "PENDIENTE → EN_PROCESO", createdAt: new Date(Date.now() - 6 * H) },
      { taskId: ready.id, userId: ana.id, kind: "READY", note: "Entregué en la carpeta compartida", createdAt: new Date(Date.now() - 1 * H) },
    ],
  });
  await prisma.taskMessage.createMany({
    data: [
      { taskId: ready.id, userId: ana.id, bodyHtml: "<p>Listo, subí el reporte y las fotos a la carpeta 📎</p>", createdAt: new Date(Date.now() - 55 * 60e3) },
      { taskId: ready.id, userId: editor.id, bodyHtml: "<p>¡Gracias, Ana! Lo reviso hoy y te aviso.</p>", createdAt: new Date(Date.now() - 40 * 60e3) },
      { taskId: ready.id, userId: ana.id, bodyHtml: "<p>Perfecto 🙌</p>", createdAt: new Date(Date.now() - 35 * 60e3) },
    ],
  });
  // Subtareas de ejemplo
  await prisma.subtask.createMany({
    data: [
      { taskId: ready.id, title: "Tomar las fotos del recorrido", assigneeId: ana.id, done: true, doneAt: new Date(Date.now() - 5 * H), doneById: ana.id, position: 0 },
      { taskId: ready.id, title: "Redactar el reporte", assigneeId: ana.id, done: true, doneAt: new Date(Date.now() - 2 * H), doneById: ana.id, position: 1 },
      { taskId: ready.id, title: "Subir los archivos a la carpeta", assigneeId: ana.id, done: false, dueAt: new Date(Date.now() + 18 * H), position: 2 },
      { taskId: prep.id, title: "Reunir las cifras de septiembre", assigneeId: ana.id, done: true, doneAt: new Date(Date.now() - 3 * H), doneById: ana.id, position: 0 },
      { taskId: prep.id, title: "Armar las láminas", position: 1 },
      { taskId: prep.id, title: "Revisar con Luis", position: 2 },
    ],
  });
  const done = await mkTask("Capacitación al personal", csa.id, expedientes.id, [luis.id], "TERMINADA", -4, "<p>Impartir la capacitación del nuevo sistema.</p>",
    [], { acceptedAt: new Date(Date.now() - 3 * H), surprise: true });
  await prisma.taskEvent.create({ data: { taskId: done.id, userId: editor.id, kind: "ACCEPTED", note: "¡Excelente trabajo, quedó muy clara la capacitación!", createdAt: new Date(Date.now() - 3 * H) } });
  await prisma.notification.createMany({
    data: [
      { userId: editor.id, kind: "TASK_READY", title: "Tarea lista para revisar: Entregar reporte de recorrido", body: "Ana Pérez — Entregué en la carpeta compartida", link: `/tareas?tarea=${ready.id}`, createdAt: new Date(Date.now() - 1 * H) },
      { userId: editor.id, kind: "TASK_MESSAGE", title: "Ana Pérez escribió en «Entregar reporte de recorrido»", body: "Perfecto 🙌", link: `/tareas?tarea=${ready.id}`, createdAt: new Date(Date.now() - 35 * 60e3) },
    ],
  });

  // 5c) Baúl de ejemplo (notas privadas de la asistente y una compartida por Luis)
  const lblClientes = await prisma.noteLabel.create({ data: { ownerId: editor.id, name: "Clientes" } });
  const lblIdeas = await prisma.noteLabel.create({ data: { ownerId: editor.id, name: "Ideas" } });
  await prisma.note.create({
    data: {
      ownerId: editor.id, title: "Ideas para el cliente", color: "yellow", pinned: true, position: 0,
      bodyHtml: "<p>Proponer un <strong>taller de capacitación</strong> el viernes y revisar el presupuesto anual.</p>",
      labels: { create: [{ labelId: lblClientes.id }, { labelId: lblIdeas.id }] },
      shares: { create: [{ userId: ana.id, canEdit: true }, { userId: luis.id, canEdit: false }] },
    },
  });
  await prisma.note.create({
    data: {
      ownerId: editor.id, title: "Pendientes de la semana", kind: "CHECKLIST", color: "green", position: 1,
      items: { create: [{ text: "Llamar al proveedor de papelería", position: 0 }, { text: "Enviar la propuesta a Horizonte", position: 1, done: true }, { text: "Revisar las facturas por vencer", position: 2 }] },
      labels: { create: [{ labelId: lblClientes.id }] },
      clientId: hrz.id,
    },
  });
  await prisma.note.create({
    data: {
      ownerId: editor.id, title: "Datos de contacto", color: "blue", position: 2, reminderAt: new Date(Date.now() + 30 * H),
      bodyHtml: "<ul><li>Roberto Salinas — 55 1234 5678</li><li>Laura Méndez (pagos) — 55 8765 4321</li></ul>",
      clientId: hrz.id,
    },
  });
  await prisma.note.create({ data: { ownerId: editor.id, color: "white", position: 3, bodyHtml: "<p>Recordar pedir la constancia fiscal actualizada.</p>" } });
  await prisma.note.create({
    data: {
      ownerId: luis.id, title: "Minuta de la reunión del lunes", color: "purple", position: 0,
      bodyHtml: "<p>Se acordó entregar el plan de trabajo el jueves.</p>",
      shares: { create: [{ userId: editor.id, canEdit: true }] },
    },
  });

  // 5b) Facturas y recibos de ejemplo (importes inventados)
  const inv = (
    kind: "FACTURA" | "RECIBO", number: string, clientId: string, rfc: string | null, description: string, subtotal: number,
    due: string, sent: string, status: "ENVIADA" | "PAGADA", software = false,
  ) => {
    const vat = kind === "FACTURA" ? Math.round(subtotal * 16) / 100 : 0;
    return prisma.invoice.create({
      data: {
        kind, number, clientId, rfc, description, subtotal: subtotal.toFixed(2), vat: vat.toFixed(2), total: (subtotal + vat).toFixed(2), isSoftware: software,
        dueDate: new Date(`${due}T00:00:00.000Z`), status, sentAt: d(sent), createdAt: d(sent), createdById: editor.id,
        ...(status === "PAGADA" ? { paidAt: d("2026-10-02"), collectedOn: new Date("2026-10-02T00:00:00.000Z"), account: "TRIADA" as const, paidById: editor.id } : {}),
      },
    });
  };
  await inv("FACTURA", "A-2026-012", hrz.id, hrz.rfc, "SERVICIOS DE CONSULTORÍA — AGOSTO 2026", 12000, "2026-09-30", "2026-09-15", "PAGADA");
  await inv("FACTURA", "A-2026-014", hrz.id, hrz.rfc, "SERVICIOS DE CONSULTORÍA — SEPTIEMBRE 2026", 15000, "2026-10-05", "2026-09-28", "ENVIADA");
  await inv("FACTURA", "A-2026-015", hrz.id, hrz.rfc, "DESARROLLO DE PORTAL DE PROVEEDORES — OCTUBRE", 8000, "2026-11-15", "2026-10-12", "ENVIADA", true);
  await inv("RECIBO", "R-007", csa.id, null, "TALLER DE CAPACITACIÓN AL PERSONAL", 3500, "2026-10-30", "2026-10-13", "ENVIADA");
  await prisma.appSetting.create({
    data: {
      key: "datos_bancarios",
      value: JSON.stringify([
        { title: "FACTURA — EMPRESA DE EJEMPLO", holder: "EMPRESA DE EJEMPLO S.A. DE C.V.", rfc: "XAXX010101000", bank: "BANCO EJEMPLO", clabe: "000000000000000001", account: "0000000001", card: "" },
        { title: "FACTURA O SIN FACTURA — PERSONA DE EJEMPLO", holder: "PERSONA DE EJEMPLO UNO", rfc: "XEXX010101000", bank: "BANCO EJEMPLO", clabe: "000000000000000002", account: "", card: "0000 0000 0000 0000" },
      ]),
    },
  });

  // 6) Registros pendientes (los envia el cliente desde el formulario publico)
  const regId = randomUUID();
  const kRegLogo = `registros/${regId}-logo-${randomUUID()}.png`;
  await putObject(kRegLogo, A("logo-estudio.png"), "image/png");
  const kRegConst = `registros/${regId}-constancia-${randomUUID()}.pdf`;
  await putObject(kRegConst, A("constancia-ejemplo.pdf"), "application/pdf");
  await prisma.clientRegistration.create({
    data: {
      id: regId, ip: "local", companyName: "Estudio Creativo Aurora", logoUrl: kRegLogo, requiresInvoice: true,
      legalName: "Estudio Creativo Aurora S.C.", rfc: "ECA190610QX3", street: "Calle Morelos 45", colonia: "Centro", postalCode: "44100",
      city: "Guadalajara", state: "Jalisco", constanciaUrl: kRegConst, contactName: "Sofía", contactLastName: "Ramírez", contactPhone: "3312345678",
      contactEmail: "sofia@estudioaurora.example", billingName: "Daniel", billingLastName: "Torres", billingPhone: "3387654321", billingEmail: "administracion@aurora.example",
    },
  });
  await prisma.clientRegistration.create({
    data: {
      ip: "local", companyName: "Panificadora La Espiga", requiresInvoice: false, contactName: "Marta", contactLastName: "Beltrán", contactPhone: "8112345678",
      contactEmail: "marta@laespiga.example", billingName: "Marta", billingLastName: "Beltrán", billingPhone: "8112345678", billingEmail: "marta@laespiga.example",
    },
  });
  console.log("Datos de ejemplo listos");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
