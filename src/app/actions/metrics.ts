"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setSetting } from "@/lib/branding";
import { parseMxInput } from "@/lib/tasks-shared";

type State = { error?: string; ok?: boolean } | undefined;

/** Umbrales del semáforo y fecha desde la que se mide (solo Administrador). */
export async function saveMetricsConfig(_p: State, fd: FormData): Promise<State> {
  await requireUser(["ADMIN"]);
  const green = Number(fd.get("green"));
  const amber = Number(fd.get("amber"));
  if (!Number.isFinite(green) || !Number.isFinite(amber) || green > 100 || amber < 1 || amber >= green) {
    return { error: "El verde debe ser mayor que el ámbar (por ejemplo 90 y 75) y estar entre 1 y 100" };
  }
  const since = String(fd.get("since") ?? "");
  const start = since ? parseMxInput(`${since}T00:00`) : null;
  if (since && !start) return { error: "La fecha desde la que se mide no es válida" };
  await setSetting("metrics_green", String(Math.round(green)));
  await setSetting("metrics_amber", String(Math.round(amber)));
  if (start) await setSetting("metrics_start", start.toISOString());
  revalidatePath("/desempeno");
  return { ok: true };
}
