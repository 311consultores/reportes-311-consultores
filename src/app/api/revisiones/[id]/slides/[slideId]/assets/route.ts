import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createLocalWriteStream, deleteObject, putObject, usesLocalStorage } from "@/lib/storage";
import { ASSET_TYPES, MAX_ASSETS, MB, REVIEW_STAFF, reviewScope } from "@/lib/reviews";

export const runtime = "nodejs";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Verifica el contenido real del archivo, no solo el tipo declarado. */
function matchesSignature(mime: string, b: Buffer) {
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/png") return b.subarray(1, 4).toString() === "PNG";
  return true;
}

type Ctx = { params: Promise<{ id: string; slideId: string }> };

/**
 * Sube un archivo del arte de un slide (solo con la revisión en borrador). El archivo llega como cuerpo directo de la petición
 * (Content-Type = tipo del archivo) para guardarlo por partes sin cargarlo completo en memoria. El nombre viaja en x-file-name.
 */
export async function POST(req: Request, routeCtx: Ctx) {
  const { id, slideId } = await routeCtx.params;
  const user = await getCurrentUser();
  if (!user || !REVIEW_STAFF.includes(user.role)) return json({ error: "No autorizado" }, 403);
  const slide = await prisma.reviewSlide.findFirst({ where: { id: slideId, reviewId: id }, include: { assets: { orderBy: { position: "asc" } }, review: true } });
  if (!slide) return json({ error: "Slide no encontrado" }, 404);
  const visible = await prisma.review.findFirst({ where: { id, ...reviewScope(user) }, select: { id: true } });
  if (!visible) return json({ error: "Slide no encontrado" }, 404);
  // En borrador se arma el arte del slide; con la revisión en ajustes se sube un arte nuevo (versión siguiente) para reemplazar el actual
  const inAdjust = slide.review.status === "EN_AJUSTES" && (slide.status === "CAMBIOS" || slide.status === "PENDIENTE");
  if (slide.review.status !== "BORRADOR" && !inAdjust) return json({ error: "Este slide ya no se puede cambiar ahora" }, 409);
  const version = slide.review.status === "BORRADOR" ? slide.artVersion : slide.artVersion + 1;
  const mine = slide.assets.filter((a) => a.version === version);

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const rule = ASSET_TYPES[mime];
  if (!rule) return json({ error: "Tipo de archivo no permitido (JPG, PNG, MP4, WEBM, MOV)" }, 400);

  // Un video va solo; las imágenes forman el carrusel (máximo 10)
  const hasVideo = mine.some((a) => a.type === "VIDEO");
  if (rule.type === "VIDEO" && mine.length > 0) return json({ error: "Un video va solo: quita primero el arte que ya tiene el slide" }, 400);
  if (rule.type === "IMAGE" && hasVideo) return json({ error: "Este slide ya tiene un video: quítalo para subir imágenes" }, 400);
  if (rule.type === "IMAGE" && mine.length >= MAX_ASSETS) return json({ error: `Un carrusel admite hasta ${MAX_ASSETS} imágenes` }, 400);

  const tooBig = () => json({ error: `El archivo excede ${rule.max / MB} MB` }, 413);
  if (Number(req.headers.get("content-length") ?? 0) > rule.max) return tooBig();
  if (!req.body) return json({ error: "Archivo requerido" }, 400);

  const key = `revisiones/${id}/${slide.id}-${randomUUID()}.${rule.ext}`;

  if (usesLocalStorage()) {
    let bytes = 0;
    let first = true;
    const guard = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        if (first) {
          first = false;
          if (!matchesSignature(mime, chunk)) return cb(new Error("FIRMA"));
        }
        bytes += chunk.length;
        if (bytes > rule.max) return cb(new Error("TAMANO"));
        cb(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(req.body as never), guard, await createLocalWriteStream(key));
      if (bytes === 0) throw new Error("VACIO");
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
    await putObject(key, buf, mime);
  }

  let name = "archivo";
  try {
    name = decodeURIComponent(req.headers.get("x-file-name") ?? "").slice(0, 190) || name;
  } catch {
    // nombre no válido: se usa el genérico
  }
  const asset = await prisma.reviewAsset.create({ data: { slideId: slide.id, key, type: rule.type, name, position: mine.length + 1, version } });
  return json({ id: asset.id, type: asset.type, name: asset.name });
}
