import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { downloadName } from "@/lib/invoice-files";
import { invoiceScope } from "@/lib/invoices";
import { serveStoredFile } from "@/lib/serve-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Descarga un archivo de una factura o recibo: el ADMINISTRADOR y el EDITOR de cualquiera; el cliente, solo de su empresa. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(fileId)) return new Response("No encontrado", { status: 404 });

  const file = await prisma.invoiceFile.findFirst({
    where: { id: fileId, invoiceId: id, removedAt: null, invoice: invoiceScope(user) },
    include: { invoice: { select: { kind: true, number: true } } },
  });
  if (!file) return new Response("No encontrado", { status: 404 });

  const ext = file.key.split(".").pop() ?? "bin";
  const nice = downloadName(file.invoice.kind, file.invoice.number, file.slot, ext);
  const type = ext === "xml" ? "application/xml" : ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "jpg" ? "image/jpeg" : "application/octet-stream";
  return serveStoredFile(req, file.key, {
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${nice.replace(/[^\x20-\x7e]/g, "").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(nice)}`,
    "Cache-Control": "private, no-store",
  });
}
