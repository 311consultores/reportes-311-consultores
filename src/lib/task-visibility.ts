import type { Prisma } from "@prisma/client";

/** Tareas ya visibles para la persona asignada: las que no se programaron o cuya fecha de aparición ya llegó. */
export const publishedWhere = (now: Date = new Date()): Prisma.TaskWhereInput => ({ OR: [{ publishAt: null }, { publishAt: { lte: now } }] });

export const isPublished = (t: { publishAt: Date | null }, now: Date = new Date()) => !t.publishAt || t.publishAt <= now;

/** Tarea encadenada que sigue esperando a que se apruebe la anterior: se puede consultar y chatear, pero no cuenta como abierta ni vencida. */
export const isWaiting = (t: { prevTaskId: string | null; activatedAt: Date | null }) => !!t.prevTaskId && !t.activatedAt;
export const notWaitingWhere = (): Prisma.TaskWhereInput => ({ NOT: { prevTaskId: { not: null }, activatedAt: null } });

/** Desde cuándo «cuenta» la tarea para quien la recibe (puntualidad, respuesta, ciclo): su aparición si se programó; si se encadenó, su activación; si no, su creación. */
export const startOf = (t: { publishAt: Date | null; createdAt: Date; activatedAt?: Date | null }) => t.publishAt ?? t.activatedAt ?? t.createdAt;
