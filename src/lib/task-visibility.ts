import type { Prisma } from "@prisma/client";

/** Tareas ya visibles para la persona asignada: las que no se programaron o cuya fecha de aparición ya llegó. */
export const publishedWhere = (now: Date = new Date()): Prisma.TaskWhereInput => ({ OR: [{ publishAt: null }, { publishAt: { lte: now } }] });

export const isPublished = (t: { publishAt: Date | null }, now: Date = new Date()) => !t.publishAt || t.publishAt <= now;

/** Desde cuándo «cuenta» la tarea para quien la recibe (puntualidad, respuesta, ciclo): su aparición si se programó; si no, su creación. */
export const startOf = (t: { publishAt: Date | null; createdAt: Date }) => t.publishAt ?? t.createdAt;
