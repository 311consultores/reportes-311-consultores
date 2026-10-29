import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { renderDocx, renderPdf } from "@/lib/docs/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const disposition = (kind: "inline" | "attachment", name: string) =>
  `${kind}; filename="${name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`;

/** PDF (vista previa o descarga) y Word de un documento. Solo Administrador y Editor. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; format: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "EDITOR")) return new Response("No autorizado", { status: 403 });
  const { id, format } = await ctx.params;
  if (format !== "pdf" && format !== "docx") return new Response("No encontrado", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new Response("No encontrado", { status: 404 });

  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    if (format === "pdf") {
      const download = new URL(req.url).searchParams.get("descargar") === "1";
      const pdf = await renderPdf(doc);
      return new Response(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": disposition(download ? "attachment" : "inline", `${doc.fileName}.pdf`) } });
    }
    const docx = renderDocx(doc);
    return new Response(new Uint8Array(docx), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": disposition("attachment", `${doc.fileName}.docx`) },
    });
  } catch (e) {
    console.error("[documentos] no se pudo generar", e);
    return new Response("No se pudo generar el documento", { status: 500 });
  }
}
