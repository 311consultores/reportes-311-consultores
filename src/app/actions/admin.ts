"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type State = { error?: string; ok?: boolean } | undefined;

const emailList = z
  .string()
  .transform((s) => s.split(/[,;\s]+/).filter(Boolean))
  .refine((l) => l.length > 0 && l.every((e) => z.string().email().safeParse(e).success), {
    message: "Correos inválidos (sepáralos con coma)",
  })
  .transform((l) => l.join(","));

function fail(e: z.ZodError): State {
  return { error: e.issues[0]?.message ?? "Datos inválidos" };
}

export async function createClient(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
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

  const exists = await prisma.client.findUnique({ where: { folioPrefix: parsed.data.folioPrefix } });
  if (exists) return { error: "Ese prefijo de folio ya existe" };

  await prisma.client.create({ data: parsed.data });
  revalidatePath("/clientes");
  return { ok: true };
}

export async function createProject(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      clientId: z.string().uuid(),
      projectName: z.string().trim().min(2, "Nombre del proyecto requerido"),
      projectEmails: emailList,
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error);

  await prisma.project.create({ data: parsed.data });
  revalidatePath("/clientes");
  return { ok: true };
}

export async function createUser(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Nombre requerido"),
      email: z.string().trim().toLowerCase().email("Correo inválido"),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
      role: z.enum(["ADMIN", "EDITOR", "CLIENTE"]),
      clientId: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error);
  const { clientId, password, ...rest } = parsed.data;

  if (rest.role === "CLIENTE" && !clientId) return { error: "Selecciona la empresa del usuario cliente" };
  if (await prisma.user.findUnique({ where: { email: rest.email } })) {
    return { error: "Ya existe un usuario con ese correo" };
  }

  await prisma.user.create({
    data: {
      ...rest,
      passwordHash: await bcrypt.hash(password, 12),
      ...(rest.role === "CLIENTE" && clientId ? { clientAccess: { create: { clientId } } } : {}),
    },
  });
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function toggleUserActive(userId: string) {
  const admin = await requireUser(["ADMIN"]);
  if (admin.id === userId) return;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;
  await prisma.user.update({ where: { id: userId }, data: { active: !u.active } });
  revalidatePath("/usuarios");
}
