"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseBirthday, removePhoto, storePhoto } from "@/lib/avatar";

type State = { error?: string; ok?: boolean } | undefined;

const ROLES = ["ADMIN", "EDITOR", "CLIENTE", "TEAM_311"] as const;

const nameField = z.string().trim().min(2, "Nombre requerido").max(120, "El nombre es demasiado largo");

/** Proyectos que existen de verdad entre los ids recibidos. */
async function validProjectIds(raw: FormDataEntryValue[]): Promise<string[]> {
  const ids = [...new Set(raw.map(String).filter((s) => /^[0-9a-f-]{36}$/i.test(s)))];
  if (ids.length === 0) return [];
  return (await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id);
}

const photoFile = (fd: FormData) => {
  const f = fd.get("photo");
  return f instanceof File && f.size > 0 ? f : null;
};

/** Alta de usuario. El Administrador crea cualquier rol; el Editor solo TEAM 311. */
export async function createUser(_p: State, fd: FormData): Promise<State> {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({
      name: nameField,
      email: z.string().trim().toLowerCase().email("Correo inválido"),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
      role: z.enum(ROLES),
      clientId: z.string().optional(),
      birthMonth: z.string().optional(),
      birthDay: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { clientId, password, birthMonth, birthDay, ...rest } = parsed.data;

  if (me.role === "EDITOR" && rest.role !== "TEAM_311") return { error: "El Editor solo puede crear usuarios TEAM 311" };
  if (rest.role === "CLIENTE" && !clientId) return { error: "Selecciona la empresa del usuario cliente" };
  if (await prisma.user.findUnique({ where: { email: rest.email } })) return { error: "Ya existe un usuario con ese correo" };

  let birthday: string | null = null;
  let photoUrl: string | null = null;
  let projectIds: string[] = [];
  if (rest.role === "TEAM_311") {
    const b = parseBirthday(birthMonth ?? "", birthDay ?? "");
    if (!b.ok) return { error: b.error };
    birthday = b.value;
    projectIds = await validProjectIds(fd.getAll("projectIds"));
    const file = photoFile(fd);
    if (file) {
      const s = await storePhoto(file);
      if (!s.ok) return { error: s.error };
      photoUrl = s.key;
    }
  }

  await prisma.user.create({
    data: {
      ...rest,
      birthday,
      photoUrl,
      passwordHash: await bcrypt.hash(password, 12),
      ...(rest.role === "CLIENTE" && clientId ? { clientAccess: { create: { clientId } } } : {}),
      ...(projectIds.length ? { projectAccess: { create: projectIds.map((projectId) => ({ projectId })) } } : {}),
    },
  });
  revalidatePath("/usuarios");
  return { ok: true };
}

/** Edición de un usuario TEAM 311: nombre, foto, cumpleaños, proyectos asignados y (opcional) nueva contraseña. */
export async function updateTeamUser(_p: State, fd: FormData): Promise<State> {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: nameField,
      email: z.string().trim().toLowerCase().email("Correo inválido").optional(),
      password: z.string().optional(),
      birthMonth: z.string().optional(),
      birthDay: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: d.id }, select: { role: true, photoUrl: true } });
  if (!target || target.role !== "TEAM_311") return { error: "Solo se pueden editar usuarios TEAM 311 desde aquí" };
  if (d.password && d.password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  const b = parseBirthday(d.birthMonth ?? "", d.birthDay ?? "");
  if (!b.ok) return { error: b.error };

  // Solo el Administrador cambia el correo
  const email = me.role === "ADMIN" ? d.email : undefined;
  if (email) {
    const dup = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (dup && dup.id !== d.id) return { error: "Ya existe un usuario con ese correo" };
  }

  let photoUrl: string | undefined;
  const file = photoFile(fd);
  if (file) {
    const s = await storePhoto(file);
    if (!s.ok) return { error: s.error };
    photoUrl = s.key;
  }
  const projectIds = await validProjectIds(fd.getAll("projectIds"));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: d.id },
      data: { name: d.name, ...(email ? { email } : {}), birthday: b.value, ...(photoUrl ? { photoUrl } : {}), ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}) },
    }),
    prisma.userProject.deleteMany({ where: { userId: d.id } }),
    prisma.userProject.createMany({ data: projectIds.map((projectId) => ({ userId: d.id, projectId })) }),
  ]);
  if (photoUrl) await removePhoto(target.photoUrl);
  revalidatePath("/usuarios");
  return { ok: true };
}

/** Edición de un usuario ADMIN, EDITOR o CLIENTE (solo Administrador). */
export async function updateUser(_p: State, fd: FormData): Promise<State> {
  const me = await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: nameField,
      email: z.string().trim().toLowerCase().email("Correo inválido"),
      password: z.string().optional(),
      role: z.enum(["ADMIN", "EDITOR", "CLIENTE"]),
      clientId: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: d.id }, select: { role: true, active: true } });
  if (!target || target.role === "TEAM_311") return { error: "Usuario no encontrado" };
  if (d.password && d.password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  if (d.id === me.id && d.role !== "ADMIN") return { error: "No puedes quitarte a ti mismo el rol de Administrador" };
  if (d.role === "CLIENTE" && !d.clientId) return { error: "Selecciona la empresa del usuario cliente" };
  const dup = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (dup && dup.id !== d.id) return { error: "Ya existe un usuario con ese correo" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: d.id },
      data: { name: d.name, email: d.email, role: d.role, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}) },
    }),
    prisma.clientUser.deleteMany({ where: { userId: d.id } }),
    ...(d.role === "CLIENTE" && d.clientId ? [prisma.clientUser.create({ data: { userId: d.id, clientId: d.clientId } })] : []),
  ]);
  revalidatePath("/usuarios");
  return { ok: true };
}

/** Elimina un usuario (solo Administrador). Si ya tiene historial, no se borra: hay que desactivarlo. */
export async function deleteUser(userId: string): Promise<{ error?: string; ok?: boolean }> {
  const me = await requireUser(["ADMIN"]);
  if (me.id === userId) return { error: "No puedes eliminar tu propio usuario" };
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          reportsCreated: true, tasksCreated: true, deletionRequests: true, deletionReviews: true, auditLogs: true,
          registrationReviews: true, invoicesCreated: true, invoicesCollected: true, invoiceLogs: true, ledgerEntries: true,
          expensesCreated: true, movementsCreated: true, editRequests: true, editReviews: true,
        },
      },
    },
  });
  if (!u) return { error: "Usuario no encontrado" };
  if (u.role === "ADMIN" && u.active && (await prisma.user.count({ where: { role: "ADMIN", active: true } })) <= 1) {
    return { error: "No puedes eliminar al único Administrador activo" };
  }
  if (Object.values(u._count).some((n) => n > 0)) {
    return { error: "Este usuario ya tiene historial (reportes, facturas o movimientos) y no puede eliminarse. Desactívalo para quitarle el acceso." };
  }
  const photo = u.photoUrl;
  await prisma.user.delete({ where: { id: userId } }); // asignaciones y accesos se borran en cascada
  await removePhoto(photo);
  revalidatePath("/usuarios");
  return { ok: true };
}

/** «Mi perfil»: el TEAM 311 cambia su propia foto y cumpleaños. */
export async function updateMyProfile(_p: State, fd: FormData): Promise<State> {
  const me = await requireUser(["TEAM_311"]);
  const b = parseBirthday(String(fd.get("birthMonth") ?? ""), String(fd.get("birthDay") ?? ""));
  if (!b.ok) return { error: b.error };

  let photoUrl: string | undefined;
  const file = photoFile(fd);
  if (file) {
    const s = await storePhoto(file);
    if (!s.ok) return { error: s.error };
    photoUrl = s.key;
  }
  const current = await prisma.user.findUnique({ where: { id: me.id }, select: { photoUrl: true } });
  await prisma.user.update({ where: { id: me.id }, data: { birthday: b.value, ...(photoUrl ? { photoUrl } : {}) } });
  if (photoUrl) await removePhoto(current?.photoUrl);
  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Activar o desactivar un usuario (el Editor solo a los TEAM 311). */
export async function toggleUserActive(userId: string) {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  if (me.id === userId) return;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;
  if (me.role === "EDITOR" && u.role !== "TEAM_311") return;
  if (u.role === "ADMIN" && u.active && (await prisma.user.count({ where: { role: "ADMIN", active: true } })) <= 1) return;
  await prisma.user.update({ where: { id: userId }, data: { active: !u.active } });
  revalidatePath("/usuarios");
}
