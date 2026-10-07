"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isBlocked, recordFailure, clearFailures } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Correo o contraseña inválidos" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const keys = [`ip:${ip}`, `email:${parsed.data.email}`];
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
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
