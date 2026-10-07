import { headers } from "next/headers";

/** URL pública del sitio: APP_URL si existe; si no, se deduce de la petición (host y protocolo). */
export async function getBaseUrl(): Promise<string> {
  const fromEnv = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.|\[::1\])/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
