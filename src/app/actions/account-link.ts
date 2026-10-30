"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, requireUser } from "@/lib/auth";
import { getLinkedAccount } from "@/lib/account-link";
import { isBlocked, recordFailure, clearFailures } from "@/lib/rate-limit";

type State = { error?: string; ok?: boolean } | undefined;

/**
 * Vincula la cuenta del Administrador con otra cuenta suya (de cualquier rol). Para comprobar que la otra cuenta es suya se pide
 * su correo y su contraseña. Solo se admite una cuenta vinculada; el vínculo queda guardado en las dos cuentas.
 */
export async function linkAccount(_p: State, fd: FormData): Promise<State> {
  const me = await requireUser(["ADMIN"]);
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Escribe el correo de la otra cuenta"), password: z.string().min(1, "Escribe la contraseña de la otra cuenta") }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const key = `link:${me.id}`;
  if (isBlocked(key)) return { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." };

  const [mine, other] = await Promise.all([
    prisma.user.findUnique({ where: { id: me.id }, select: { linkedUserId: true } }),
    prisma.user.findUnique({ where: { email: parsed.data.email } }),
  ]);
  if (mine?.linkedUserId) return { error: "Tu cuenta ya tiene una cuenta vinculada. Desvincúlala primero para vincular otra." };
  if (!other || !other.active || !(await bcrypt.compare(parsed.data.password, other.passwordHash))) {
    recordFailure(key);
    return { error: "El correo o la contraseña de la otra cuenta no son correctos" };
  }
  clearFailures(key);
  if (other.id === me.id) return { error: "Esa es tu cuenta actual; escribe los datos de la otra cuenta" };
  if (other.linkedUserId) return { error: "Esa cuenta ya está vinculada con otra" };

  await prisma.$transaction([
    prisma.user.update({ where: { id: me.id }, data: { linkedUserId: other.id } }),
    prisma.user.update({ where: { id: other.id }, data: { linkedUserId: me.id } }),
  ]);
  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Quita el vínculo (solo el Administrador; se limpian las dos cuentas). */
export async function unlinkAccount(): Promise<{ error?: string }> {
  const me = await requireUser(["ADMIN"]);
  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { linkedUserId: true } });
  if (!row?.linkedUserId) return {};
  await prisma.$transaction([
    prisma.user.update({ where: { id: me.id }, data: { linkedUserId: null } }),
    prisma.user.updateMany({ where: { id: row.linkedUserId, linkedUserId: me.id }, data: { linkedUserId: null } }),
  ]);
  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return {};
}

/** Cambia de una cuenta a la otra sin pedir contraseña (el vínculo ya lo validó el Administrador). */
export async function switchAccount(): Promise<void> {
  const me = await requireUser();
  const other = await getLinkedAccount(me.id, me.role);
  if (!other) redirect("/");
  await createSession(other.id);
  redirect(other.role === "TEAM_311" || other.role === "PROJECT_311" ? "/tareas" : "/");
}
