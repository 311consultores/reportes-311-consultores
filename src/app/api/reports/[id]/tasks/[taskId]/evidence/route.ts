import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { putObject, deleteObject } from "@/lib/storage";
import { auditDetails } from "@/lib/consultants";
import { MAX_EVIDENCES } from "@/lib/limits";

export const runtime = "nodejs";

const MB = 1024 * 1024;
const ALLOWED: Record<string, { type: "IMAGE" | "PDF" | "VIDEO"; ext: string; max: number }> = {
  "image/jpeg": { type: "IMAGE", ext: "jpg", max: 8 * MB },
  "image/png": { type: "IMAGE", ext: "png", max: 8 * MB },
  "application/pdf": { type: "PDF", ext: "pdf", max: 15 * MB },
  "video/mp4": { type: "VIDEO", ext: "mp4", max: 100 * MB },
  "video/webm": { type: "VIDEO", ext: "webm", max: 100 * MB },
  "video/quicktime": { type: "VIDEO", ext: "mov", max: 100 * MB },
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Verifica el contenido real del archivo, no solo el tipo declarado. */
function matchesSignature(mime: string, b: Buffer) {
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/png") return b.subarray(1, 4).toString() === "PNG";
  if (mime === "application/pdf") return b.subarray(0, 4).toString() === "%PDF";
  return true;
}

async function load(id: string, taskId: string) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return { error: json({ error: "No autorizado" }, 403) };
  const task = await prisma.reportTask.findFirst({
    where: { id: taskId, reportId: id },
    include: { report: { select: { status: true } }, evidences: true },
  });
  if (!task) return { error: json({ error: "Actividad no encontrada" }, 404) };
  if (task.report.status !== "EN_PROCESO" && task.report.status !== "RECHAZADO") {
    return { error: json({ error: "El reporte ya no es editable" }, 409) };
  }
  return { user, task };
}

type Ctx = { params: Promise<{ id: string; taskId: string }> };

/** Agrega una evidencia (máximo 3 por actividad). */
export async function POST(req: Request, routeCtx: Ctx) {
  const params = await routeCtx.params;
  const ctx = await load(params.id, params.taskId);
  if (ctx.error) return ctx.error;
  const { user, task } = ctx;

  if (task.evidences.length >= MAX_EVIDENCES) {
    return json({ error: `Cada actividad admite hasta ${MAX_EVIDENCES} evidencias` }, 400);
  }

  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return json({ error: "Archivo requerido" }, 400);

  const rule = ALLOWED[file.type];
  if (!rule) return json({ error: "Tipo de archivo no permitido (JPG, PNG, PDF, MP4, WEBM, MOV)" }, 400);
  if (file.size > rule.max) return json({ error: `El archivo excede ${rule.max / MB} MB` }, 400);

  const buf = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(file.type, buf)) return json({ error: "El contenido no coincide con el tipo de archivo" }, 400);

  const key = `reports/${params.id}/${task.id}-${randomUUID()}.${rule.ext}`;
  await putObject(key, buf, file.type);

  const ev = await prisma.taskEvidence.create({ data: { taskId: task.id, url: key, type: rule.type } });
  await prisma.auditLog.create({
    data: {
      reportId: params.id,
      userId: user.id,
      action: `UPLOADED_EVIDENCE_TASK_${task.sequentialNum}`,
      details: auditDetails({ type: rule.type }),
    },
  });

  return json({ id: ev.id, url: ev.url, type: ev.type });
}

/** Quita una evidencia: DELETE ...?id=<evidenceId> */
export async function DELETE(req: Request, routeCtx: Ctx) {
  const params = await routeCtx.params;
  const ctx = await load(params.id, params.taskId);
  if (ctx.error) return ctx.error;
  const { user, task } = ctx;

  const evidenceId = new URL(req.url).searchParams.get("id");
  const ev = task.evidences.find((e) => e.id === evidenceId);
  if (!ev) return json({ error: "Evidencia no encontrada" }, 404);

  await prisma.taskEvidence.delete({ where: { id: ev.id } });
  await deleteObject(ev.url).catch(() => {});
  await prisma.auditLog.create({
    data: { reportId: params.id, userId: user.id, action: `REMOVED_EVIDENCE_TASK_${task.sequentialNum}` },
  });
  return json({ ok: true });
}
