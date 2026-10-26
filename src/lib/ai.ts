/**
 * Asistente de IA (Claude, de Anthropic). Solo explica y sugiere: nunca aplica cambios.
 * La clave vive únicamente en ANTHROPIC_API_KEY del servidor. Nunca se envían credenciales de Meta ni datos de acceso.
 */

export const aiReady = () => !!process.env.ANTHROPIC_API_KEY?.trim();
const MODEL = () => process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";

export async function askClaude(opts: { system: string; user: string; maxTokens?: number }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("El asistente de IA aún no está configurado: falta ANTHROPIC_API_KEY en el servidor.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL(), max_tokens: opts.maxTokens ?? 700, system: opts.system, messages: [{ role: "user", content: opts.user }] }),
    signal: AbortSignal.timeout(40_000),
  });
  const json = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ? `El asistente no pudo responder: ${json.error.message}` : "El asistente no pudo responder. Intenta de nuevo.");
  return (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
}

/** Límite sencillo por persona (en memoria): evita gastar la clave por error con clics repetidos. */
const hits = new Map<string, number[]>();
export function aiAllowed(userId: string, perMinute = 12): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= perMinute) return false;
  hits.set(userId, [...list, now]);
  return true;
}
