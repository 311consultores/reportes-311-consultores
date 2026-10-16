import { prisma } from "@/lib/prisma";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { contentTypeFor, getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Archivos de un registro pendiente (logo o constancia). Solo Admin y Editor. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return new Response("No autorizado", { status: 403 });
  if (file !== "logo" && file !== "constancia") return new Response("No encontrado", { status: 404 });

  const reg = await prisma.clientRegistration.findUnique({
    where: { id },
    select: { logoUrl: true, constanciaUrl: true },
  });
  const key = file === "logo" ? reg?.logoUrl : reg?.constanciaUrl;
  if (!key) return new Response("No encontrado", { status: 404 });

  try {
    return new Response(new Uint8Array(await getObject(key)), {
      headers: {
        "Content-Type": contentTypeFor(key),
        "Content-Disposition": `inline; filename="${file === "logo" ? "logo" : "constancia-situacion-fiscal.pdf"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
