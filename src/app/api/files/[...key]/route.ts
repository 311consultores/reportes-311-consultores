import { prisma } from "@/lib/prisma";
import { getCurrentUser, reportScope } from "@/lib/auth";
import { contentTypeFor, getDownloadUrl, getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const params = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const key = params.key.join("/");
  const m = key.match(/^reports\/([0-9a-f-]{36})\/[\w.-]+$/);
  if (!m) return new Response("No encontrado", { status: 404 });

  const report = await prisma.report.findFirst({
    where: { id: m[1], ...reportScope(user) },
    select: { id: true },
  });
  if (!report) return new Response("No encontrado", { status: 404 });

  const url = await getDownloadUrl(key);
  if (url) return Response.redirect(url, 302);

  try {
    const buf = await getObject(key);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": contentTypeFor(key), "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
