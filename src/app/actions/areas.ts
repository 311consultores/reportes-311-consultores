"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type State = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del área").max(100, "El nombre es demasiado largo"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
});

const refresh = () => {
  revalidatePath("/configuracion");
  revalidatePath("/tareas");
  revalidatePath("/usuarios");
};

/** Crea un área (solo Administrador). El nombre se guarda en mayúsculas. */
export async function createArea(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const p = schema.safeParse({ name: fd.get("name"), color: fd.get("color") });
  if (!p.success) return { error: p.error.issues[0].message };
  const name = p.data.name.toLocaleUpperCase("es-MX");
  if (await prisma.area.findUnique({ where: { name } })) return { error: "Ya existe un área con ese nombre" };
  await prisma.area.create({ data: { name, color: p.data.color } });
  refresh();
  return { ok: true };
}

/** Renombra o cambia el color de un área (solo Administrador). */
export async function updateArea(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const id = String(fd.get("id") ?? "");
  const p = schema.safeParse({ name: fd.get("name"), color: fd.get("color") });
  if (!p.success) return { error: p.error.issues[0].message };
  const name = p.data.name.toLocaleUpperCase("es-MX");
  const dup = await prisma.area.findUnique({ where: { name }, select: { id: true } });
  if (dup && dup.id !== id) return { error: "Ya existe un área con ese nombre" };
  if (!(await prisma.area.findUnique({ where: { id }, select: { id: true } }))) return { error: "El área no existe" };
  await prisma.area.update({ where: { id }, data: { name, color: p.data.color } });
  refresh();
  return { ok: true };
}

/** Desactiva o reactiva un área (solo Administrador). Una área desactivada conserva su historial pero ya no se ofrece al crear tareas. */
export async function toggleAreaActive(id: string) {
  await requireUser(["ADMIN"]);
  const a = await prisma.area.findUnique({ where: { id } });
  if (!a) return;
  await prisma.area.update({ where: { id }, data: { active: !a.active } });
  refresh();
}
