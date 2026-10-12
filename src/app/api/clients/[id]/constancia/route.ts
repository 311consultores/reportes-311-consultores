import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constancia de Situación Fiscal de un cliente. Solo Admin y Editor (nunca el rol Cliente). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || user.role === "CLIENTE") return new Response("No autorizado", { status: 403 });

  const client = await prisma.client.findUnique({ where: { id }, select: { constanciaUrl: true, companyName: true } });
  if (!client?.constanciaUrl) return new Response("No encontrado", { status: 404 });

  try {
    return new Response(new Uint8Array(await getObject(client.constanciaUrl)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="constancia-situacion-fiscal.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
