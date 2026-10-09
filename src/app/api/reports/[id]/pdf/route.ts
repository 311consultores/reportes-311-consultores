import { prisma } from "@/lib/prisma";
import { getCurrentUser, reportScope } from "@/lib/auth";
import { getReportPdf } from "@/lib/pdf-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const exists = await prisma.report.findFirst({
    where: { id: params.id, ...reportScope(user) },
    select: { id: true },
  });
  if (!exists) return new Response("No encontrado", { status: 404 });

  // Cola de una a la vez + caché: ver pdf-queue.ts
  const { buffer, folio } = await getReportPdf(params.id);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${folio}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
