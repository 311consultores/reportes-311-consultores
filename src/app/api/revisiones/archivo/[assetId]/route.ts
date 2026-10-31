import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { reviewScope } from "@/lib/reviews";
import { serveStoredFile } from "@/lib/serve-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entrega un archivo (imagen o video) de una revisión a quien tiene acceso a ella. */
export async function GET(req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return new Response("No encontrado", { status: 404 });

  const asset = await prisma.reviewAsset.findUnique({ where: { id: assetId }, include: { slide: { select: { reviewId: true, artVersion: true } } } });
  if (!asset) return new Response("No encontrado", { status: 404 });
  const ok = await prisma.review.findFirst({ where: { id: asset.slide.reviewId, ...reviewScope(user) }, select: { id: true } });
  if (!ok) return new Response("No encontrado", { status: 404 });
  // El cliente solo ve el arte ya aplicado (no el nuevo que el equipo todavía prepara)
  if (user.role === "CLIENTE" && asset.version > asset.slide.artVersion) return new Response("No encontrado", { status: 404 });
  return serveStoredFile(req, asset.key);
}
