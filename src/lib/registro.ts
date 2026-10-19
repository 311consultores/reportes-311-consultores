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

/**
 * Posibles duplicados: coincide el RFC o algún correo (contacto principal o de administración) con un cliente
 * o con otro registro pendiente. El nombre ya no cuenta como coincidencia.
 */
export async function findDuplicates(
  data: { rfc: string | null; emails: string[] },
  excludeRegistrationId?: string,
): Promise<Duplicate[]> {
  const emails = [...new Set(data.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const rfc = data.rfc?.trim().toUpperCase() || null;
  if (!rfc && emails.length === 0) return [];

  const [clients, regs] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          ...(rfc ? [{ rfc }] : []),
          ...emails.flatMap((e) => [{ contactEmail: e }, { billingEmail: e }, { mainEmails: { contains: e } }]),
        ],
      },
      select: { id: true, companyName: true, rfc: true, mainEmails: true, contactEmail: true, billingEmail: true },
      take: 5,
    }),
    prisma.clientRegistration.findMany({
      where: {
        status: "PENDIENTE",
        ...(excludeRegistrationId ? { id: { not: excludeRegistrationId } } : {}),
        OR: [...(rfc ? [{ rfc }] : []), ...emails.flatMap((e) => [{ contactEmail: e }, { billingEmail: e }])],
      },
      select: { id: true, companyName: true, rfc: true, contactEmail: true, billingEmail: true },
      take: 5,
    }),
  ]);

  const why = (c: { rfc: string | null; mainEmails?: string; contactEmail: string | null; billingEmail: string | null }) => {
    const theirs = [...(c.mainEmails ?? "").split(","), c.contactEmail ?? "", c.billingEmail ?? ""].map((e) => e.trim().toLowerCase());
    return [rfc && c.rfc === rfc ? "mismo RFC" : null, emails.some((e) => theirs.includes(e)) ? "mismo correo" : null].filter(Boolean).join(" y ") || "dato parecido";
  };
  return [
    ...clients.map((c) => ({ kind: "cliente" as const, id: c.id, companyName: c.companyName, rfc: c.rfc, why: why(c) })),
    ...regs.map((c) => ({ kind: "registro" as const, id: c.id, companyName: c.companyName, rfc: c.rfc, why: why(c) })),
  ];
}
