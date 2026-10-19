import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GiphyItem = { id: string; title?: string; images: { fixed_height_small: { url: string }; downsized: { url: string }; original: { url: string } } };

/** Búsqueda de GIF con Giphy. Requiere la variable GIPHY_API_KEY; sin ella el chat funciona sin GIF. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "EDITOR", "TEAM_311"].includes(user.role)) return Response.json({ error: "No autorizado" }, { status: 403 });
  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) return Response.json({ configured: false, results: [] });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const url = new URL(q ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending");
  url.searchParams.set("api_key", key);
  url.searchParams.set("limit", "24");
  url.searchParams.set("rating", "g");
  if (q) {
    url.searchParams.set("q", q);
    url.searchParams.set("lang", "es");
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return Response.json({ configured: true, results: [], error: "Giphy no respondió" }, { status: 502 });
    const data = (await res.json()) as { data?: GiphyItem[] };
    const results = (data.data ?? []).map((g) => ({ id: g.id, title: g.title ?? "", preview: g.images.fixed_height_small.url, url: g.images.downsized?.url ?? g.images.original.url }));
    return Response.json({ configured: true, results });
  } catch {
    return Response.json({ configured: true, results: [], error: "No se pudo consultar Giphy" }, { status: 502 });
  }
}
