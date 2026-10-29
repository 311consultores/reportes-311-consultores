"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/whatsapp";
import { parseBirthday, removePhoto, storePhoto } from "@/lib/avatar";

type State = { error?: string; ok?: boolean } | undefined;

const ROLES = ["ADMIN", "EDITOR", "CLIENTE", "TEAM_311", "PROJECT_311"] as const;

/** Roles de equipo que también puede gestionar el Editor. */
const isTeamRole = (r: string) => r === "TEAM_311" || r === "PROJECT_311";

/** Roles que el Editor puede crear y editar: el equipo y los usuarios CLIENTE (sin cambiar su rol ni eliminarlos). */
const editorManages = (r: string) => isTeamRole(r) || r === "CLIENTE";

const nameField = z.string().trim().min(2, "Nombre requerido").max(120, "El nombre es demasiado largo");

/** Proyectos que existen de verdad entre los ids recibidos. */
async function validProjectIds(raw: FormDataEntryValue[]): Promise<string[]> {
  const ids = [...new Set(raw.map(String).filter((s) => /^[0-9a-f-]{36}$/i.test(s)))];
  if (ids.length === 0) return [];
  return (await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id);
}

/** Teléfono opcional: se guarda solo con dígitos (10 para México, o con lada). */
function parsePhone(fd: FormData): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = String(fd.get("phone") ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const n = normalizePhone(raw);
  if (!n) return { ok: false, error: "El teléfono debe tener 10 dígitos (o incluir la lada del país)" };
  return { ok: true, value: n };
}

/** Áreas que existen de verdad entre los ids recibidos. */
async function validAreaIds(raw: FormDataEntryValue[]): Promise<string[]> {
  const ids = [...new Set(raw.map(String).filter((s) => /^[0-9a-f-]{36}$/i.test(s)))];
  if (ids.length === 0) return [];
  return (await prisma.area.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((a) => a.id);
}

const photoFile = (fd: FormData) => {
  const f = fd.get("photo");
  return f instanceof File && f.size > 0 ? f : null;
};

/** Alta de usuario. El Administrador crea cualquier rol; el Editor solo CLIENTE, TEAM 311 y PROJECT 311. */
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

  if (me.role === "EDITOR" && !editorManages(rest.role)) return { error: "El Editor solo puede crear usuarios CLIENTE, TEAM 311 y PROJECT 311" };
  if (rest.role === "CLIENTE" && !clientId) return { error: "Selecciona la empresa del usuario cliente" };
  if (await prisma.user.findUnique({ where: { email: rest.email } })) return { error: "Ya existe un usuario con ese correo" };

  let birthday: string | null = null;
  let photoUrl: string | null = null;
  let projectIds: string[] = [];
  if (rest.role !== "CLIENTE") {
    // Foto y cumpleaños: todo el personal (todo el personal); los proyectos asignados, solo el TEAM 311
    const b = parseBirthday(birthMonth ?? "", birthDay ?? "");
    if (!b.ok) return { error: b.error };
    birthday = b.value;
    if (rest.role === "TEAM_311") projectIds = await validProjectIds(fd.getAll("projectIds"));
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

/** Edición de un usuario TEAM 311 o PROJECT 311: nombre, foto, cumpleaños, proyectos asignados y (opcional) nueva contraseña. */
export async function updateTeamUser(_p: State, fd: FormData): Promise<State> {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: nameField,
      email: z.string().trim().toLowerCase().email("Correo inválido").optional(),
      password: z.string().optional(),
      role: z.enum(["TEAM_311", "PROJECT_311", "EDITOR", "ADMIN"]).optional(),
      birthMonth: z.string().optional(),
      birthDay: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: d.id }, select: { role: true, photoUrl: true, active: true } });
  if (!target || !isTeamRole(target.role)) return { error: "Solo se pueden editar usuarios TEAM 311 o PROJECT 311 desde aquí" };
  if (d.password && d.password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  const b = parseBirthday(d.birthMonth ?? "", d.birthDay ?? "");
  if (!b.ok) return { error: b.error };
  const ph = parsePhone(fd);
  if (!ph.ok) return { error: ph.error };

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
  // Cambio de rol: solo el Administrador, y no el propio
  const newRole = me.role === "ADMIN" && d.role && d.role !== target.role ? d.role : target.role;
  if (newRole !== target.role && d.id === me.id) return { error: "No puedes cambiar tu propio rol" };
  const finalRole = newRole;
  const projectIds = await validProjectIds(fd.getAll("projectIds"));
  const areaIds = isTeamRole(finalRole) ? await validAreaIds(fd.getAll("areaIds")) : [];

  await prisma.$transaction([
    prisma.user.update({
      where: { id: d.id },
      data: { name: d.name, role: finalRole, ...(email ? { email } : {}), birthday: b.value, phone: ph.value, ...(photoUrl ? { photoUrl } : {}), ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}) },
    }),
    // Los proyectos asignados (para reportes) solo aplican al TEAM 311
    ...(finalRole === "TEAM_311"
      ? [prisma.userProject.deleteMany({ where: { userId: d.id } }), prisma.userProject.createMany({ data: projectIds.map((projectId) => ({ userId: d.id, projectId })) })]
      : [prisma.userProject.deleteMany({ where: { userId: d.id } })]),
    // Áreas del equipo (varias por persona)
    prisma.userArea.deleteMany({ where: { userId: d.id } }),
    prisma.userArea.createMany({ data: areaIds.map((areaId) => ({ userId: d.id, areaId })) }),
  ]);
  if (photoUrl) await removePhoto(target.photoUrl);
  revalidatePath("/usuarios");
  return { ok: true };
}

/** Edición de un usuario ADMIN, EDITOR o CLIENTE, con cambio de rol (solo Administrador). El Editor solo edita usuarios CLIENTE, sin cambiarles el rol. */
export async function updateUser(_p: State, fd: FormData): Promise<State> {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: nameField,
      email: z.string().trim().toLowerCase().email("Correo inválido"),
      password: z.string().optional(),
      role: z.enum(["ADMIN", "EDITOR", "CLIENTE", "TEAM_311", "PROJECT_311"]),
      clientId: z.string().optional(),
      birthMonth: z.string().optional(),
      birthDay: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: d.id }, select: { role: true, active: true, photoUrl: true } });
  if (!target || isTeamRole(target.role)) return { error: "Usuario no encontrado" };
  if (me.role === "EDITOR" && (target.role !== "CLIENTE" || d.role !== "CLIENTE")) return { error: "El Editor solo puede editar usuarios CLIENTE" };
  if (target.role === "ADMIN" && d.role !== "ADMIN" && target.active && (await prisma.user.count({ where: { role: "ADMIN", active: true } })) <= 1) return { error: "No puedes quitar el rol al único Administrador activo" };
  if (d.password && d.password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  if (d.id === me.id && d.role !== "ADMIN") return { error: "No puedes quitarte a ti mismo el rol de Administrador" };
  if (d.role === "CLIENTE" && !d.clientId) return { error: "Selecciona la empresa del usuario cliente" };
  const dup = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (dup && dup.id !== d.id) return { error: "Ya existe un usuario con ese correo" };

  // Foto y cumpleaños (el Cliente no los tiene)
  let birthday: string | null | undefined;
  let photoUrl: string | undefined;
  if (d.role !== "CLIENTE") {
    const b = parseBirthday(d.birthMonth ?? "", d.birthDay ?? "");
    if (!b.ok) return { error: b.error };
    birthday = b.value;
    const file = photoFile(fd);
    if (file) {
      const s = await storePhoto(file);
      if (!s.ok) return { error: s.error };
      photoUrl = s.key;
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: d.id },
      data: {
        name: d.name, email: d.email, role: d.role,
        ...(birthday !== undefined ? { birthday } : {}),
        ...(photoUrl ? { photoUrl } : {}),
        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}),
      },
    }),
    prisma.clientUser.deleteMany({ where: { userId: d.id } }),
    // Al cambiar de rol se limpian los datos que ya no aplican (proyectos de reportes solo del TEAM 311; áreas solo de TEAM 311 y PROJECT 311)
    ...(d.role !== "TEAM_311" ? [prisma.userProject.deleteMany({ where: { userId: d.id } })] : []),
    ...(!isTeamRole(d.role) ? [prisma.userArea.deleteMany({ where: { userId: d.id } })] : []),
    ...(d.role === "CLIENTE" && d.clientId ? [prisma.clientUser.create({ data: { userId: d.id, clientId: d.clientId } })] : []),
  ]);
  if (photoUrl) await removePhoto(target.photoUrl);
  revalidatePath("/usuarios");
  return { ok: true };
}

/** Elimina un usuario (solo Administrador). Si ya tiene historial, no se borra: hay que desactivarlo. */
export async function deleteUser(userId: string, reason: string): Promise<{ error?: string; ok?: boolean; hasHistory?: boolean }> {
  const me = await requireUser(["ADMIN"]);
  const why = reason.trim().slice(0, 500);
  if (why.length < 3) return { error: "Escribe el motivo de la eliminación (mínimo 3 caracteres)" };
  if (me.id === userId) return { error: "No puedes eliminar tu propio usuario" };
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          reportsCreated: true, tasksCreated: true, deletionRequests: true, deletionReviews: true, auditLogs: true,
          registrationReviews: true, invoicesCreated: true, invoicesCollected: true, invoiceLogs: true, ledgerEntries: true,
          expensesCreated: true, movementsCreated: true, editRequests: true, editReviews: true, workTasksCreated: true, taskEvents: true,
        },
      },
    },
  });
  if (!u) return { error: "Usuario no encontrado" };
  if (u.role === "ADMIN" && u.active && (await prisma.user.count({ where: { role: "ADMIN", active: true } })) <= 1) {
    return { error: "No puedes eliminar al único Administrador activo" };
  }
  if (Object.values(u._count).some((n) => n > 0)) {
    return { error: "Este usuario ya tiene historial (reportes, facturas o movimientos) y no puede eliminarse.", hasHistory: true };
  }
  const photo = u.photoUrl;
  const now = new Date();
  await prisma.$transaction([
    prisma.user.delete({ where: { id: userId } }), // asignaciones y accesos se borran en cascada
    // Queda en el Log con su motivo
    prisma.deletionRequest.create({
      data: {
        targetType: "USER", targetId: userId, targetLabel: `${u.name} (${u.email})`, reason: why,
        requestedById: me.id, reviewedById: me.id, status: "APROBADO", resolvedAt: now,
      },
    }),
  ]);
  await removePhoto(photo);
  revalidatePath("/usuarios");
  return { ok: true };
}

/** «Mi perfil»: el personal interno cambia su propia foto y cumpleaños. */
export async function updateMyProfile(_p: State, fd: FormData): Promise<State> {
  const me = await requireUser(["ADMIN", "EDITOR", "TEAM_311", "PROJECT_311"]);
  const b = parseBirthday(String(fd.get("birthMonth") ?? ""), String(fd.get("birthDay") ?? ""));
  if (!b.ok) return { error: b.error };
  const ph = parsePhone(fd);
  if (!ph.ok) return { error: ph.error };

  let photoUrl: string | undefined;
  const file = photoFile(fd);
  if (file) {
    const s = await storePhoto(file);
    if (!s.ok) return { error: s.error };
    photoUrl = s.key;
  }
  const current = await prisma.user.findUnique({ where: { id: me.id }, select: { photoUrl: true } });
  await prisma.user.update({ where: { id: me.id }, data: { birthday: b.value, phone: ph.value, ...(photoUrl ? { photoUrl } : {}) } });
  if (photoUrl) await removePhoto(current?.photoUrl);
  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Activar o desactivar un usuario (el Editor solo a CLIENTE, TEAM 311 y PROJECT 311). */
export async function toggleUserActive(userId: string) {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  if (me.id === userId) return;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;
  if (me.role === "EDITOR" && !editorManages(u.role)) return;
  if (u.role === "ADMIN" && u.active && (await prisma.user.count({ where: { role: "ADMIN", active: true } })) <= 1) return;
  await prisma.user.update({ where: { id: userId }, data: { active: !u.active } });
  revalidatePath("/usuarios");
}
