import type { Prisma } from "@prisma/client";

const TZ = "America/Mexico_City";

/** Fecha en formato DDMMAA, con la hora de México. */
export function folioDate(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}${get("month")}${get("year")}`;
}

/**
 * Siguiente folio de un cliente: PREFIJO + consecutivo (3 dígitos mínimo) + DDMMAA, p. ej. LAJ001071026.
 * El consecutivo vive en Client.folioSeq y se incrementa de forma atómica dentro de la transacción,
 * por lo que no se repite ni se reinicia, y pasa a 4 dígitos después del 999.
 */
export async function nextFolio(
  tx: Prisma.TransactionClient,
  clientId: string,
  now: Date = new Date(),
): Promise<string> {
  const c = await tx.client.update({
    where: { id: clientId },
    data: { folioSeq: { increment: 1 } },
    select: { folioPrefix: true, folioSeq: true },
  });
  return `${c.folioPrefix}${String(c.folioSeq).padStart(3, "0")}${folioDate(now)}`;
}
