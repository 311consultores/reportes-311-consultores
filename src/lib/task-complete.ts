/**
 * Evolutivo 20: un BORRADOR puede no tener cliente, proyecto ni fecha de entrega. Toda tarea que ya salió de borradores sí los tiene.
 * Estos ayudantes dejan que el código que solo maneja tareas «reales» (avisos, métricas, recordatorios) siga tratándolas como completas.
 */
type Maybe = { client: unknown; project: unknown; dueAt: unknown };

export type Complete<T extends Maybe> = Omit<T, "client" | "project" | "dueAt" | "clientId" | "projectId"> & {
  client: NonNullable<T["client"]>;
  project: NonNullable<T["project"]>;
  dueAt: Date;
  clientId: string;
  projectId: string;
};

export const isComplete = <T extends Maybe>(t: T): t is T & Complete<T> => !!t.client && !!t.project && !!t.dueAt;

/** Deja solo las tareas completas (descarta los borradores). */
export const onlyComplete = <T extends Maybe>(rows: T[]): Complete<T>[] => rows.filter((r) => isComplete(r)) as unknown as Complete<T>[];

/** Una tarea completa o null si es un borrador. */
export const asComplete = <T extends Maybe>(t: T): Complete<T> | null => (isComplete(t) ? (t as unknown as Complete<T>) : null);
