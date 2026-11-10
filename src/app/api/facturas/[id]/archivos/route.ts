import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { putObject } from "@/lib/storage";
import { isSlot, matchesSignature, MAX_INVOICE_FILE, SLOT_INFO, SLOTS_BY_KIND } from "@/lib/invoice-files";

export const runtime = "nodejs";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Sube el PDF o XML de una factura (o el comprobante de un recibo simple). Solo ADMINISTRADOR y EDITOR.
 * El archivo llega como cuerpo directo (Content-Type = tipo del archivo); ?slot=PDF|XML|COMPROBANTE y el nombre en x-file-name.
 * Si ya había uno en ese lugar, se reemplaza: el anterior queda marcado como quitado y registrado en el historial.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "EDITOR")) return json({ error: "No autorizado" }, 403);
  const inv = /^[0-9a-f-]{36}$/i.test(id) ? await prisma.invoice.findUnique({ where: { id }, select: { id: true, kind: true } }) : null;
  if (!inv) return json({ error: "Documento no encontrado" }, 404);

  const slot = new URL(req.url).searchParams.get("slot");
  if (!isSlot(slot) || !SLOTS_BY_KIND[inv.kind].includes(slot)) return json({ error: "Ese archivo no corresponde a este tipo de documento" }, 400);
  const info = SLOT_INFO[slot];
  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = info.mimes[mime];
  if (!ext) return json({ error: `Tipo de archivo no permitido para «${info.label}»` }, 400);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_INVOICE_FILE) return json({ error: "El archivo excede 10 MB" }, 413);

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) return json({ error: "Archivo requerido" }, 400);
  if (buf.length > MAX_INVOICE_FILE) return json({ error: "El archivo excede 10 MB" }, 413);
  if (!matchesSignature(slot, mime, buf)) return json({ error: "El contenido no coincide con el tipo de archivo" }, 400);

  let name = `archivo.${ext}`;
  try {
    name = decodeURIComponent(req.headers.get("x-file-name") ?? "").slice(0, 190) || name;
  } catch {
    // nombre no válido: se usa el genérico
  }
  const key = `facturas/${id}/${randomUUID()}.${ext}`;
  await putObject(key, buf, mime);

  const old = await prisma.invoiceFile.findFirst({ where: { invoiceId: id, slot, removedAt: null } });
  await prisma.$transaction([
    ...(old ? [prisma.invoiceFile.update({ where: { id: old.id }, data: { removedAt: new Date(), removedById: user.id } })] : []),
    prisma.invoiceFile.create({ data: { invoiceId: id, slot, key, name, size: buf.length, uploadedById: user.id } }),
    prisma.invoiceLog.create({
      data: { invoiceId: id, userId: user.id, action: old ? "FILE_REPLACED" : "FILE_ADDED", details: JSON.stringify({ slot, name, ...(old ? { previous: old.name } : {}) }) },
    }),
  ]);
  return json({ ok: true });
}
