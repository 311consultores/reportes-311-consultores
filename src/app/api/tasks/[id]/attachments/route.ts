import { isTaskManager, STAFF_ROLES } from "@/lib/roles";
import { isPublished } from "@/lib/task-visibility";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { putObject, deleteObject, usesLocalStorage, createLocalWriteStream } from "@/lib/storage";

export const runtime = "nodejs";

const MB = 1024 * 1024;
type Rule = { type: "IMAGE" | "VIDEO" | "FILE"; ext: string; max: number };
const OFFICE = "application/vnd.openxmlformats-officedocument.";
const ALLOWED: Record<string, Rule> = {
  "image/jpeg": { type: "IMAGE", ext: "jpg", max: 8 * MB },
  "image/png": { type: "IMAGE", ext: "png", max: 8 * MB },
  "image/webp": { type: "IMAGE", ext: "webp", max: 8 * MB },
  "image/gif": { type: "IMAGE", ext: "gif", max: 8 * MB },
  "video/mp4": { type: "VIDEO", ext: "mp4", max: 100 * MB },
  "video/webm": { type: "VIDEO", ext: "webm", max: 100 * MB },
  "video/quicktime": { type: "VIDEO", ext: "mov", max: 100 * MB },
  "application/pdf": { type: "FILE", ext: "pdf", max: 15 * MB },
  [OFFICE + "wordprocessingml.document"]: { type: "FILE", ext: "docx", max: 15 * MB },
  [OFFICE + "spreadsheetml.sheet"]: { type: "FILE", ext: "xlsx", max: 15 * MB },
  [OFFICE + "presentationml.presentation"]: { type: "FILE", ext: "pptx", max: 15 * MB },
  "text/plain": { type: "FILE", ext: "txt", max: 15 * MB },
  "text/csv": { type: "FILE", ext: "csv", max: 15 * MB },
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Verifica el contenido real del archivo, no solo el tipo declarado. */
function matchesSignature(mime: string, b: Buffer) {
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/png") return b.subarray(1, 4).toString() === "PNG";
  if (mime === "image/gif") return b.subarray(0, 3).toString() === "GIF";
  if (mime === "image/webp") return b.subarray(0, 4).toString() === "RIFF";
  if (mime === "application/pdf") return b.subarray(0, 4).toString() === "%PDF";
  if (mime.startsWith(OFFICE)) return b[0] === 0x50 && b[1] === 0x4b; // zip
  return true;
}

async function load(taskId: string) {
  const user = await getCurrentUser();
  if (!user || !STAFF_ROLES.includes(user.role)) return { error: json({ error: "No autorizado" }, 403) };
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, publishAt: true, assignees: { select: { userId: true } } } });
  const allowed = task && (isTaskManager(user.role) || (task.assignees.some((a) => a.userId === user.id) && isPublished(task)));
  if (!task || !allowed) return { error: json({ error: "Tarea no encontrada" }, 404) };
  return { user, task };
}

type Ctx = { params: Promise<{ id: string }> };

/** Sube un adjunto del chat (queda «pendiente» hasta que se envía el mensaje). El archivo llega como cuerpo directo. */
export async function POST(req: Request, routeCtx: Ctx) {
  const { id } = await routeCtx.params;
  const ctx = await load(id);
  if (ctx.error) return ctx.error;
  const { user, task } = ctx;

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const rule = ALLOWED[mime];
  if (!rule) return json({ error: "Tipo de archivo no permitido (imágenes, videos MP4/WEBM/MOV, PDF, Word, Excel, PowerPoint, TXT o CSV)" }, 400);
  const name = decodeURIComponent(req.headers.get("x-filename") ?? "archivo").replace(/[\u0000-\u001f]/g, "").slice(0, 190) || "archivo";

  const pendings = await prisma.taskAttachment.count({ where: { taskId: task.id, uploadedById: user.id, messageId: null } });
  if (pendings >= 6) return json({ error: "Puedes adjuntar hasta 6 archivos por mensaje" }, 400);

  const tooBig = () => json({ error: `El archivo excede ${rule.max / MB} MB` }, 413);
  if (Number(req.headers.get("content-length") ?? 0) > rule.max) return tooBig();
  if (!req.body) return json({ error: "Archivo requerido" }, 400);

  const key = `tareas/${task.id}/${randomUUID()}.${rule.ext}`;
  let size = 0;
  if (usesLocalStorage()) {
    let first = true;
    const guard = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        if (first) {
          first = false;
          if (!matchesSignature(mime, chunk)) return cb(new Error("FIRMA"));
        }
        size += chunk.length;
        if (size > rule.max) return cb(new Error("TAMANO"));
        cb(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(req.body as never), guard, await createLocalWriteStream(key));
      if (size === 0) throw new Error("VACIO");
    } catch (e) {
      await deleteObject(key).catch(() => {});
      const code = e instanceof Error ? e.message : "";
      if (code === "TAMANO") return tooBig();
      if (code === "FIRMA") return json({ error: "El contenido no coincide con el tipo de archivo" }, 400);
      return json({ error: "No se pudo recibir el archivo" }, 400);
    }
  } else {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) return json({ error: "Archivo requerido" }, 400);
    if (buf.length > rule.max) return tooBig();
    if (!matchesSignature(mime, buf)) return json({ error: "El contenido no coincide con el tipo de archivo" }, 400);
    size = buf.length;
    await putObject(key, buf, mime);
  }

  const att = await prisma.taskAttachment.create({ data: { taskId: task.id, uploadedById: user.id, key, type: rule.type, name, size } });
  return json({ id: att.id, key: att.key, type: att.type, name: att.name, size: att.size });
}

/** Quita un adjunto que todavía no se ha enviado: DELETE ...?id=<attachmentId> */
export async function DELETE(req: Request, routeCtx: Ctx) {
  const { id } = await routeCtx.params;
  const ctx = await load(id);
  if (ctx.error) return ctx.error;
  const attId = new URL(req.url).searchParams.get("id") ?? "";
  const att = await prisma.taskAttachment.findFirst({ where: { id: attId, taskId: ctx.task.id, uploadedById: ctx.user.id, messageId: null } });
  if (!att) return json({ error: "Adjunto no encontrado" }, 404);
  await prisma.taskAttachment.delete({ where: { id: att.id } });
  await deleteObject(att.key).catch(() => {});
  return json({ ok: true });
}
