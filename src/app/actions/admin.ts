"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { splitEmails, uniqueEmails } from "@/lib/emails";
import { validateLogo, storeLogo, replaceClientLogo } from "@/lib/branding";

type State = { error?: string; ok?: boolean } | undefined;

const validEmails = (l: string[]) => l.every((e) => z.string().email().safeParse(e).success);
const emailList = z
  .string()
  .transform((s) => uniqueEmails(splitEmails(s)))
  .refine((l) => l.length > 0 && validEmails(l), { message: "Agrega al menos un correo válido" })
  .transform((l) => l.join(","));
/** Igual, pero se permite dejarlo vacío (correos del proyecto). */
const optionalEmailList = z
  .string()
  .transform((s) => uniqueEmails(splitEmails(s)))
  .refine(validEmails, { message: "Hay un correo inválido" })
  .transform((l) => l.join(","));

function fail(e: z.ZodError): State {
  return { error: e.issues[0]?.message ?? "Datos inválidos" };
}

export async function createClient(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({
      companyName: z.string().trim().min(2, "Nombre requerido"),
      folioPrefix: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{2,6}$/, "Prefijo: 2 a 6 letras/números"),
      mainEmails: emailList,
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error);

  const exists = await prisma.client.findUnique({
    where: { folioPrefix: parsed.data.folioPrefix },
    select: { companyName: true },
  });
  if (exists) {
    return {
      error: `El prefijo ${parsed.data.folioPrefix} ya lo usa «${exists.companyName}». Ajústalo manualmente (por ejemplo, otra combinación de letras).`,
    };
  }

  // Logo opcional (PNG o JPG, máx. 2 MB)
  let logoKey: string | undefined;
  const file = fd.get("logo");
  if (file instanceof File && file.size > 0) {
    const v = await validateLogo(file);
    if (!v.ok) return { error: v.error };
    logoKey = await storeLogo("client", v);
  }

  await prisma.client.create({ data: { ...parsed.data, ...(logoKey ? { logoUrl: logoKey } : {}) } });
  revalidatePath("/clientes");
  return { ok: true };
}

export async function updateClientLogo(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN", "EDITOR"]);
  const clientId = z.string().uuid().safeParse(fd.get("clientId"));
  const file = fd.get("logo");
  if (!clientId.success || !(file instanceof File) || file.size === 0) return { error: "Selecciona una imagen PNG o JPG" };
  const v = await validateLogo(file);
  if (!v.ok) return { error: v.error };
  await replaceClientLogo(clientId.data, v);
  revalidatePath("/clientes");
  return { ok: true };
}

export async function createProject(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      projectName: z.string().trim().min(2, "Nombre del proyecto requerido"),
      projectEmails: optionalEmailList,
      responsibleName: z.string().trim().min(2, "Escribe el nombre del responsable del proyecto").max(120),
      responsibleLastName: z.string().trim().min(2, "Escribe el apellido del responsable del proyecto").max(120),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error);

  await prisma.project.create({ data: parsed.data });
  revalidatePath("/clientes");
  return { ok: true };
}
