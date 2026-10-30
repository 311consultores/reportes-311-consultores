import { Readable } from "node:stream";
import { contentTypeFor, getDownloadUrl, localSize, openLocalStream } from "@/lib/storage";

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

/**
 * Entrega un archivo guardado (el permiso ya se validó antes): redirige a una URL firmada si se usa S3 o lo envía por partes
 * desde disco, con soporte de rangos (adelantar videos) y sin cargarlo completo en memoria.
 */
export async function serveStoredFile(req: Request, key: string, extra: Record<string, string> = {}): Promise<Response> {
  const url = await getDownloadUrl(key);
  if (url) return Response.redirect(url, 302);

  const size = await localSize(key);
  if (size === null) return new Response("No encontrado", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(key),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    ...extra,
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
