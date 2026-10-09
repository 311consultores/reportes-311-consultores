import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, reportScope } from "@/lib/auth";
import { contentTypeFor, getDownloadUrl, localSize, openLocalStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Interpreta "bytes=ini-fin" (un solo rango). Devuelve null si no es válido. */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    const n = Number(m[2]); // últimos n bytes
    start = Math.max(size - n, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}

export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
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

  // Archivo local: se envía por partes (streaming) y con soporte de rangos (adelantar videos),
  // sin cargarlo completo en memoria
  const size = await localSize(key);
  if (size === null) return new Response("No encontrado", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(key),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
  };

  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const range = parseRange(rangeHeader, size);
    if (!range) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(openLocalStream(key, range)) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Length": String(range.end - range.start + 1), "Content-Range": `bytes ${range.start}-${range.end}/${size}` },
    });
  }

  const stream = Readable.toWeb(openLocalStream(key)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
