import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET no está definido o es demasiado corto (mínimo 16 caracteres)");
  return new TextEncoder().encode(s);
};

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        clientAccess: { select: { clientId: true } },
      },
    });
    return user && user.active ? user : null;
  } catch {
    return null;
  }
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

export const canEdit = (role: Role) => role === "ADMIN" || role === "EDITOR";

/** Reportes visibles para el usuario: los clientes solo ven los enviados de su empresa. */
export function reportScope(user: CurrentUser): Prisma.ReportWhereInput {
  if (user.role !== "CLIENTE") return {};
  return {
    clientId: { in: user.clientAccess.map((c) => c.clientId) },
    status: "ENVIADO",
  };
}
