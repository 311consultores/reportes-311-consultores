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
  await prisma.user.deleteMany({ where: { role: "CLIENTE" } });
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
      constanciaUrl: kConst, contactName: "Roberto Salinas", contactPhone: "5512345678", contactEmail: "roberto.salinas@horizonte.example",
      billingName: "Laura Méndez", billingPhone: "5587654321", billingEmail: "pagos@horizonte.example",
    },
  });
  const csa = await prisma.client.create({
    data: {
      companyName: "Clínica Santa Aurora", folioPrefix: "CSA", mainEmails: "direccion@aurora.example", logoUrl: kCsa, folioSeq: 2,
      requiresInvoice: false, contactName: "Dra. Patricia Vega", contactPhone: "3398765432", contactEmail: "direccion@aurora.example",
      billingName: "Jorge Ibarra", billingPhone: "3311223344", billingEmail: "administracion@aurora.example",
    },
  });
  const torre = await prisma.project.create({ data: { clientId: hrz.id, projectName: "Torre Norte", projectEmails: "coordinador@horizonte.example" } });
  await prisma.project.create({ data: { clientId: hrz.id, projectName: "Plaza Comercial Sur", projectEmails: "plaza@horizonte.example" } });
  const expedientes = await prisma.project.create({ data: { clientId: csa.id, projectName: "Modernización de expedientes", projectEmails: "sistemas@aurora.example" } });

  // 5) Reportes
  type T = { title: string; html: string; photos: string[] };
  async function report(folio: string, clientId: string, projectId: string, status: ReportStatus, start: string, end: string, created: string, tasks: T[], rejection?: string) {
    const r = await prisma.report.create({
      data: {
        folio, clientId, projectId, status, startDate: d(start), endDate: d(end), createdAt: d(created), createdById: editor.id,
        consultants: JSON.stringify(["Ana Pérez", "Luis Gómez"]), rejectionComment: rejection ?? null,
      },
    });
    await prisma.auditLog.create({ data: { reportId: r.id, userId: editor.id, action: "CREATED_REPORT", createdAt: d(created) } });
    let n = 0;
    for (const t of tasks) {
      n++;
      const task = await prisma.reportTask.create({
        data: { reportId: r.id, sequentialNum: n, title: t.title, descriptionHtml: t.html, createdById: editor.id, createdAt: d(created) },
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
  await report("CSA002091026", csa.id, expedientes.id, "TERMINADO", "2026-10-05", "2026-10-09", "2026-10-09", [{ title: "Revisión de expedientes", html: p2, photos: ["foto-2.jpg"] }]);
  await report("HRZ003091026", hrz.id, torre.id, "EN_PROCESO", "2026-10-05", "2026-10-09", "2026-10-09", [
    { title: "Reunión de arranque", html: p1, photos: ["foto-1.jpg", "foto-2.jpg"] },
    { title: "Recorrido en obra", html: p2, photos: ["foto-2.jpg"] },
    { title: "", html: "", photos: [] },
  ]);

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
      city: "Guadalajara", state: "Jalisco", constanciaUrl: kRegConst, contactName: "Sofía Ramírez", contactPhone: "3312345678",
      contactEmail: "sofia@estudioaurora.example", billingName: "Daniel Torres", billingPhone: "3387654321", billingEmail: "daniel@estudioaurora.example",
    },
  });
  await prisma.clientRegistration.create({
    data: {
      ip: "local", companyName: "Panificadora La Espiga", requiresInvoice: false, contactName: "Marta Beltrán", contactPhone: "8112345678",
      contactEmail: "marta@laespiga.example", billingName: "Marta Beltrán", billingPhone: "8112345678", billingEmail: "marta@laespiga.example",
    },
  });
  console.log("Datos de ejemplo listos");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
