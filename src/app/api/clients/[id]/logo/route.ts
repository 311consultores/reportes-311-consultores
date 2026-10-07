import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readLogo } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Logo de un cliente. Un usuario Cliente solo puede ver el de su propia empresa. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.role === "CLIENTE" && !user.clientAccess.some((c) => c.clientId === id)) {
    return new Response("No encontrado", { status: 404 });
  }

  const client = await prisma.client.findUnique({ where: { id }, select: { logoUrl: true } });
  if (!client?.logoUrl) return new Response(null, { status: 404 });

  const etag = `"${client.logoUrl}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const logo = await readLogo(client.logoUrl);
  if (!logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(logo.data), { headers: { ...headers, "Content-Type": logo.contentType } });
}
