"use server";

import { revalidatePath } from "next/cache";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/roles";
import { notifyUsers } from "@/lib/notifications";
import { ALL, getRankingFor, MAX_POINTS_PER_SECOND, monthPeriod, RUN_TOKEN_MAX_MS, type Ranking } from "@/lib/retas";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

export type RetasState = { month: Ranking; all: Ranking; monthLabel: string };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const labelOf = (period: string) => (period === ALL ? "de siempre" : `de ${MONTHS[Number(period.slice(5, 7)) - 1]}`);

export async function getRetas(): Promise<RetasState> {
  const me = await requireUser(STAFF_ROLES);
  const mp = monthPeriod();
  const [month, all] = await Promise.all([getRankingFor(mp, me.id), getRankingFor(ALL, me.id)]);
  return { month, all, monthLabel: MONTHS[Number(mp.slice(5, 7)) - 1] };
}

/** Al empezar una partida el servidor firma la hora de inicio: así el puntaje se valida contra el tiempo real que duró. */
export async function startRun(): Promise<{ token: string }> {
  const me = await requireUser(STAFF_ROLES);
  const token = await new SignJWT({ u: me.id, t: Date.now() }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30m").sign(secret());
  return { token };
}

/**
 * Guarda el puntaje de una partida terminada. Solo cuenta si mejora el mejor de la persona (del mes y/o de siempre).
 * Avisa en la campanita a quien fue superado y, si se llega al primer lugar, a quien lo tenía.
 */
export async function submitScore(token: string, score: number): Promise<{ error?: string; newMonthBest?: boolean; newAllBest?: boolean; state?: RetasState }> {
  const me = await requireUser(STAFF_ROLES);
  if (!Number.isInteger(score) || score < 0 || score > 1_000_000) return { error: "Puntaje no válido" };
  let startedAt: number;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.u !== me.id || typeof payload.t !== "number") return { error: "Partida no válida" };
    startedAt = payload.t;
  } catch {
    return { error: "La partida expiró" };
  }
  const elapsed = Date.now() - startedAt;
  if (elapsed > RUN_TOKEN_MAX_MS) return { error: "La partida expiró" };
  if (score > (elapsed / 1000) * MAX_POINTS_PER_SECOND + 15) return { error: "Puntaje no válido" }; // imposible en ese tiempo

  const mp = monthPeriod();
  let newMonthBest = false;
  let newAllBest = false;
  for (const period of [mp, ALL]) {
    const prev = await prisma.gameScore.findUnique({ where: { userId_period: { userId: me.id, period } } });
    if (prev && prev.score >= score) continue;
    const before = await getRankingFor(period, me.id); // posiciones antes de guardar
    const topBefore = before.rows[0];
    await prisma.gameScore.upsert({
      where: { userId_period: { userId: me.id, period } },
      create: { userId: me.id, period, score },
      update: { score, achievedAt: new Date() },
    });
    if (period === mp) newMonthBest = true;
    else newAllBest = true;

    // Avisos: quienes quedaron por debajo del nuevo puntaje (y por encima del anterior de esta persona)
    const nowFirst = !topBefore || topBefore.userId === me.id || topBefore.score < score;
    // Quien tenía el primer lugar recibe un aviso propio; los demás superados reciben el de «superó tu récord»
    const passed = before.rows.filter((r) => r.userId !== me.id && r.score < score && r.score >= (prev?.score ?? 0) && !(nowFirst && r.userId === topBefore?.userId)).slice(0, 5);
    if (passed.length) {
      await notifyUsers(passed.map((r) => r.userId), { actorId: me.id, kind: "GAME_BEATEN", title: `🏆 ${me.name} superó tu récord ${labelOf(period)} en Las Retas`, body: `Ahora tiene ${score} puntos. ¡Ve por la revancha!`, link: "/retas" });
    }
    if (nowFirst && topBefore && topBefore.userId !== me.id) {
      await notifyUsers([topBefore.userId], { actorId: me.id, kind: "GAME_BEATEN", title: `👑 ${me.name} te quitó el primer lugar ${labelOf(period)} en Las Retas`, body: `${score} puntos contra tus ${topBefore.score}.`, link: "/retas" });
    }
  }
  revalidatePath("/retas");
  return { newMonthBest, newAllBest, state: await getRetas() };
}

/** Quita el puntaje de una persona (solo Administrador): del mes, de siempre o ambos. */
export async function removeScore(userId: string, scope: "month" | "all" | "both"): Promise<RetasState> {
  await requireUser(["ADMIN"]);
  const periods = scope === "month" ? [monthPeriod()] : scope === "all" ? [ALL] : [monthPeriod(), ALL];
  await prisma.gameScore.deleteMany({ where: { userId, period: { in: periods } } });
  revalidatePath("/retas");
  return getRetas();
}

/** Reinicia el ranking (solo Administrador): el del mes, el de siempre o ambos. */
export async function resetRanking(scope: "month" | "all" | "both"): Promise<RetasState> {
  await requireUser(["ADMIN"]);
  const where = scope === "month" ? { period: monthPeriod() } : scope === "all" ? { period: ALL } : {};
  await prisma.gameScore.deleteMany({ where });
  revalidatePath("/retas");
  return getRetas();
}
