"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateLogo, replaceLogo311 } from "@/lib/branding";

type State = { error?: string; ok?: boolean } | undefined;

/** Configuración (solo Admin): logo de 311 CONSULTORES. */
export async function uploadLogo311(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona una imagen PNG o JPG" };
  const v = await validateLogo(file);
  if (!v.ok) return { error: v.error };
  await replaceLogo311(v);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Modo claro/oscuro del usuario (Editor y Admin). El rol Cliente siempre usa claro. */
export async function setTheme(theme: "light" | "dark") {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  if (theme !== "light" && theme !== "dark") return;
  await prisma.user.update({ where: { id: user.id }, data: { theme } });
}
