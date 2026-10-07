"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { isBlocked, recordFailure, clearFailures } from "@/lib/rate-limit";
import { getBaseUrl } from "@/lib/base-url";
import { sendMail } from "@/lib/mailer";
import { passwordResetEmail } from "@/lib/email-templates";
import { readLogo311 } from "@/lib/branding";

type State = { error?: string; ok?: boolean } | undefined;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Solo se permiten rutas internas (evita redirecciones a otros sitios). */
export async function safeNext(next: unknown): Promise<string> {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

export async function login(_prev: State, formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Correo o contraseña inválidos" };

  const keys = [`ip:${await clientIp()}`, `email:${parsed.data.email}`];
  if (keys.some(isBlocked)) return { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." };

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const ok = user?.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
    if (!user || !ok) {
      keys.forEach(recordFailure);
      return { error: "Correo o contraseña incorrectos" };
    }

    keys.forEach(clearFailures);
    await createSession(user.id);
  } catch (e) {
    // Muestra solo un código (nunca el detalle) para poder diagnosticar la instalación
    console.error("[login] error:", e);
    const err = e as { name?: string; code?: string; errorCode?: string; message?: string };
    const code = err.code ?? err.errorCode ?? err.name ?? "desconocido";
    const hint = /AUTH_SECRET/.test(err.message ?? "") ? " Falta la variable AUTH_SECRET." : "";
    return { error: `Error del servidor (${code}).${hint} Revisa /api/health.` };
  }
  redirect(await safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/** Paso 1: envía por correo un enlace temporal (1 hora). Siempre responde igual para no revelar qué correos existen. */
export async function requestPasswordReset(_prev: State, fd: FormData): Promise<State> {
  const parsed = z.string().email().safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Escribe un correo válido" };
  const email = parsed.data;

  const keys = [`reset-ip:${await clientIp()}`, `reset-mail:${email}`];
  if (keys.some(isBlocked)) return { ok: true, error: undefined }; // sin pistas
  keys.forEach(recordFailure); // cuenta cada solicitud: máximo 5 por 15 minutos

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.active) {
      const token = randomBytes(32).toString("hex");
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const link = `${await getBaseUrl()}/restablecer?token=${token}`;
      const logo = await readLogo311();
      const mail = passwordResetEmail({ name: user.name, link, withLogo: !!logo });
      await sendMail({
        to: [user.email],
        ...mail,
        inline: logo
          ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }]
          : undefined,
      });
    }
  } catch (e) {
    console.error("[recuperar] error:", e);
  }
  return { ok: true };
}

const newPassword = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(100, "La contraseña es demasiado larga");

/** ¿El token existe, no se ha usado y no ha vencido? */
export async function validateResetToken(token: string): Promise<boolean> {
  return !!(await findValidReset(token));
}

async function findValidReset(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    include: { user: { select: { id: true, active: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.active) return null;
  return row;
}

/** Paso 2: define la nueva contraseña con el token recibido. */
export async function resetPassword(_prev: State, fd: FormData): Promise<State> {
  const token = String(fd.get("token") ?? "");
  const password = newPassword.safeParse(fd.get("password"));
  if (!password.success) return { error: password.error.issues[0].message };
  if (fd.get("password") !== fd.get("confirm")) return { error: "Las contraseñas no coinciden" };

  const row = await findValidReset(token);
  if (!row) return { error: "El enlace no es válido o ya venció. Solicita uno nuevo." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(password.data, 12) } }),
    prisma.passwordReset.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
}
