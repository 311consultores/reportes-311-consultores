import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readLogo } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Foto de perfil de un usuario TEAM 311. La puede ver cualquier usuario con sesión (aparece en los reportes). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const row = await prisma.user.findUnique({ where: { id }, select: { photoUrl: true } });
  if (!row?.photoUrl) return new Response(null, { status: 404 });

  const etag = `"${row.photoUrl}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const photo = await readLogo(row.photoUrl);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), { headers: { ...headers, "Content-Type": photo.contentType } });
}
