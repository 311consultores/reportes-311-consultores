import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/branding";

const KEY = "registro_activo";

/** El enlace público de registro está activo salvo que el Admin lo haya desactivado. */
export async function registroActivo(): Promise<boolean> {
  return (await getSetting(KEY)) !== "0";
}

export const setRegistroActivo = (active: boolean) => setSetting(KEY, active ? "1" : "0");

/** Dirección que recibe el aviso de cada registro nuevo. */
export const registroNotifyEmail = () => process.env.REGISTRO_NOTIFY_EMAIL?.trim() || "admon@311consultores.com";

export type Duplicate = { kind: "cliente" | "registro"; id: string; companyName: string; rfc: string | null; why: string };

/** Posibles duplicados por nombre o RFC (el nombre ignora mayúsculas y acentos por la colación de la base). */
export async function findDuplicates(
  data: { companyName: string; rfc: string | null },
  excludeRegistrationId?: string,
): Promise<Duplicate[]> {
  const byName = { companyName: data.companyName };
  const [clients, regs] = await Promise.all([
    prisma.client.findMany({
      where: { OR: [byName, ...(data.rfc ? [{ rfc: data.rfc }] : [])] },
      select: { id: true, companyName: true, rfc: true },
      take: 5,
    }),
    prisma.clientRegistration.findMany({
      where: {
        status: "PENDIENTE",
        ...(excludeRegistrationId ? { id: { not: excludeRegistrationId } } : {}),
        OR: [byName, ...(data.rfc ? [{ rfc: data.rfc }] : [])],
      },
      select: { id: true, companyName: true, rfc: true },
      take: 5,
    }),
  ]);
  const why = (n: string, r: string | null) =>
    [n.toLowerCase() === data.companyName.toLowerCase() ? "mismo nombre" : null, data.rfc && r === data.rfc ? "mismo RFC" : null]
      .filter(Boolean)
      .join(" y ") || "nombre parecido";
  return [
    ...clients.map((c) => ({ kind: "cliente" as const, ...c, why: why(c.companyName, c.rfc) })),
    ...regs.map((c) => ({ kind: "registro" as const, ...c, why: why(c.companyName, c.rfc) })),
  ];
}
