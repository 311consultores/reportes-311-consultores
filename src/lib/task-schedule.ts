/** ¿La tarea ya es visible para la persona asignada? (versión para el navegador, con fechas ISO). */
export const isPublishedIso = (publishAt: string | null, now: Date = new Date()) => !publishAt || new Date(publishAt) <= now;
