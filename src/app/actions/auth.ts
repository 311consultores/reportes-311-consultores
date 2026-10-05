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

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user?.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !ok) {
    keys.forEach(recordFailure);
    return { error: "Correo o contraseña incorrectos" };
  }

  keys.forEach(clearFailures);
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
