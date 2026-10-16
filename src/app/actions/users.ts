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
  await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: nameField,
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
      data: { name: d.name, birthday: b.value, ...(photoUrl ? { photoUrl } : {}), ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}) },
    }),
    prisma.userProject.deleteMany({ where: { userId: d.id } }),
    prisma.userProject.createMany({ data: projectIds.map((projectId) => ({ userId: d.id, projectId })) }),
  ]);
  if (photoUrl) await removePhoto(target.photoUrl);
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
  await prisma.user.update({ where: { id: userId }, data: { active: !u.active } });
  revalidatePath("/usuarios");
}
