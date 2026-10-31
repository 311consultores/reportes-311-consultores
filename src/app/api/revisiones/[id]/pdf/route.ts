import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { reviewScope } from "@/lib/reviews";
import { buildReviewPdf } from "@/lib/review-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF resumen de una revisión aprobada, para el cliente y el equipo con acceso a ella. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const review = await prisma.review.findFirst({ where: { id, ...reviewScope(user) }, select: { status: true } });
  if (!review) return new Response("No encontrado", { status: 404 });
  if (review.status !== "APROBADA") return new Response("El resumen se genera cuando la revisión está aprobada", { status: 409 });

  const { buffer, title } = await buildReviewPdf(id);
  const ascii = `Revision aprobada - ${title}`.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "").slice(0, 120) || "Revision aprobada";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(`Revisión aprobada - ${title}.pdf`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
