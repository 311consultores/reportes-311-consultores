import { getLogo311Key, readLogo } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Logo de 311 CONSULTORES. Es público: se usa en el login y en la recuperación de contraseña. */
export async function GET(req: Request) {
  const key = await getLogo311Key();
  if (!key) return new Response(null, { status: 404 });

  // El ETag cambia al subir un logo nuevo: el navegador lo revalida y no se queda con uno viejo
  const etag = `"${key}"`;
  const headers = { ETag: etag, "Cache-Control": "public, no-cache" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const logo = await readLogo(key);
  if (!logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(logo.data), { headers: { ...headers, "Content-Type": logo.contentType } });
}
