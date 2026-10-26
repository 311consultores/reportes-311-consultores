"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { META_ROLES } from "@/lib/roles";
import { aiAllowed, askClaude } from "@/lib/ai";
import { accessibleAccounts, listAdAccounts, MetaError } from "@/lib/meta";
import { LAYERS } from "@/lib/meta-glossary";

type State = { error?: string; ok?: boolean; message?: string } | undefined;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(demo\)/g, "").trim();

/** Importa las cuentas publicitarias que ve la conexión de Meta (solo Administrador). Si el nombre coincide con un cliente, lo liga. */
export async function syncMetaAccounts(): Promise<State> {
  await requireUser(["ADMIN"]);
  try {
    const found = await listAdAccounts();
    const clients = await prisma.client.findMany({ select: { id: true, companyName: true } });
    let created = 0;
    for (const a of found) {
      const exists = await prisma.metaAccount.findUnique({ where: { adAccountId: a.adAccountId }, select: { id: true } });
      const guess = clients.find((c) => norm(a.name).includes(norm(c.companyName)) || norm(c.companyName).includes(norm(a.name)));
      await prisma.metaAccount.upsert({
        where: { adAccountId: a.adAccountId },
        create: { adAccountId: a.adAccountId, name: a.name, currency: a.currency, clientId: guess?.id ?? null, lastSyncAt: new Date() },
        update: { name: a.name, currency: a.currency, lastSyncAt: new Date() },
      });
      if (!exists) created++;
    }
    revalidatePath("/meta");
    revalidatePath("/meta/conexion");
    return { ok: true, message: `${found.length} cuenta(s) encontradas; ${created} nueva(s).` };
  } catch (e) {
    return { error: e instanceof MetaError || e instanceof Error ? e.message : "No se pudo consultar Meta" };
  }
}

/** Liga una cuenta a un cliente, la activa o desactiva y define qué personas la ven (solo Administrador). */
export async function saveMetaAccount(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const id = String(fd.get("id") ?? "");
  const clientId = String(fd.get("clientId") ?? "");
  const userIds = [...new Set(fd.getAll("userIds").map(String).filter((s) => /^[0-9a-f-]{36}$/i.test(s)))];
  const acc = await prisma.metaAccount.findUnique({ where: { id }, select: { id: true } });
  if (!acc) return { error: "La cuenta no existe" };
  if (clientId && !(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) return { error: "El cliente no existe" };
  const people = await prisma.user.findMany({ where: { id: { in: userIds }, role: { in: ["EDITOR", "PROJECT_311"] }, active: true }, select: { id: true } });
  await prisma.$transaction([
    prisma.metaAccount.update({ where: { id }, data: { clientId: clientId || null, active: fd.get("active") === "on" } }),
    prisma.metaAccess.deleteMany({ where: { accountId: id } }),
    prisma.metaAccess.createMany({ data: people.map((p) => ({ accountId: id, userId: p.id })) }),
  ]);
  revalidatePath("/meta");
  revalidatePath("/meta/conexion");
  return { ok: true };
}

const SYSTEM = `Eres el guía de campañas de Meta (Facebook e Instagram Ads) del portal de 311 Consultores. Hablas con personas que casi no saben de publicidad digital.
Reglas:
- Responde en español claro, con frases cortas y sin tecnicismos. Si usas un término de Meta, explícalo en una frase.
- Usa máximo 6 viñetas o 3 párrafos breves. Empieza por lo más importante.
- Explica qué es lo que se está viendo, si algo requiere atención y qué puede hacer la persona en el siguiente paso.
- NUNCA inventes cifras ni datos que no estén en lo que recibes. Si no sabes algo, dilo.
- No puedes cambiar nada en Meta: solo explicas y sugieres. La persona decide.
- Si hay una categoría especial (crédito, empleo, vivienda, política), recuerda que Meta restringe la segmentación (por ejemplo edad, género y ubicaciones muy precisas) y revisa más los textos.
- Si el estado es «Rechazada» o «Con problemas», explica las causas más comunes de forma general y sugiere revisar el motivo exacto en el Administrador de anuncios.`;

/** Pide al asistente que explique una campaña, un conjunto o un anuncio en lenguaje simple. */
export async function explainMeta(input: { layer: "campaign" | "adset" | "ad"; accountId: string; data: unknown }): Promise<{ text?: string; error?: string }> {
  const user = await requireUser(META_ROLES);
  const allowed = (await accessibleAccounts(user)).some((a) => a.id === input.accountId);
  if (!allowed) return { error: "No tienes acceso a esa cuenta" };
  if (!aiAllowed(user.id)) return { error: "Hiciste varias consultas seguidas; espera un momento e intenta de nuevo." };
  const payload = JSON.stringify(input.data ?? {}).slice(0, 5000);
  try {
    const text = await askClaude({
      system: SYSTEM,
      user: `Explícame esto (${LAYERS[input.layer].title}). Contexto de este nivel: ${LAYERS[input.layer].help}\n\nDatos tal como los devuelve Meta (en JSON; los presupuestos están en centavos):\n${payload}`,
    });
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "El asistente no pudo responder" };
  }
}
