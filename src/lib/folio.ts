import type { Prisma } from "@prisma/client";

/**
 * Genera el siguiente folio consecutivo para un cliente: "311" + prefijo + número de 3 dígitos
 * (ej. 311CEM001). Debe ejecutarse dentro de una transacción para evitar colisiones;
 * la restricción @unique de Report.folio protege ante condiciones de carrera.
 */
export async function nextFolio(
  tx: Prisma.TransactionClient,
  clientId: string,
): Promise<string> {
  const client = await tx.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { folioPrefix: true },
  });
  const base = `311${client.folioPrefix}`;

  const last = await tx.report.findFirst({
    where: { clientId, folio: { startsWith: base } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });

  const lastNum = last ? parseInt(last.folio.slice(base.length), 10) : 0;
  return `${base}${String(lastNum + 1).padStart(3, "0")}`;
}
