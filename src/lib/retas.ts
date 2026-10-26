import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/tasks-shared";

/** Puntos por segundo máximos que el juego puede dar (la velocidad crece con el tiempo); sirve para descartar puntajes imposibles. */
export const MAX_POINTS_PER_SECOND = 75;
export const RUN_TOKEN_MAX_MS = 30 * 60_000;
export const RANKING_SIZE = 20;

export const ALL = "ALL";
export const monthPeriod = (now: Date = new Date()) => dayKey(now).slice(0, 7); // «AAAA-MM» en hora de México

export type RankingRow = { userId: string; name: string; photoUrl: string | null; score: number; position: number };
export type Ranking = { period: string; rows: RankingRow[]; mine: RankingRow | null };

/** Tabla de posiciones de un periodo («ALL» o «AAAA-MM»): mejor puntaje de cada persona activa, de mayor a menor. */
export async function getRankingFor(period: string, meId: string): Promise<Ranking> {
  const rows = await prisma.gameScore.findMany({
    where: { period, user: { active: true } },
    orderBy: [{ score: "desc" }, { achievedAt: "asc" }],
    include: { user: { select: { name: true, photoUrl: true } } },
  });
  const all: RankingRow[] = rows.map((r, i) => ({ userId: r.userId, name: r.user.name, photoUrl: r.user.photoUrl, score: r.score, position: i + 1 }));
  return { period, rows: all.slice(0, RANKING_SIZE), mine: all.find((r) => r.userId === meId) ?? null };
}
