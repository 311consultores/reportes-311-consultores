import { prisma } from "@/lib/prisma";
import { validEvidenceSig } from "@/lib/evidence-link";
import { serveStoredFile } from "@/lib/serve-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enlace público a una evidencia (el de los iconos del PDF): se valida por la firma del enlace, no por sesión. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !validEvidenceSig(id, sig)) return new Response("No encontrado", { status: 404 });
  const ev = await prisma.taskEvidence.findUnique({ where: { id }, select: { url: true } });
  if (!ev) return new Response("Este archivo ya no está disponible", { status: 404 });
  return serveStoredFile(req, ev.url, { "X-Robots-Tag": "noindex", "Content-Disposition": "inline" });
}
