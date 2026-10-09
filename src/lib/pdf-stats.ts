/** Contadores de generación de PDF, para el diagnóstico (/api/health). */
type G = typeof globalThis & { __pdfStats?: { activos: number; enCola: number; cacheHits: number; generados: number } };
const g = globalThis as G;
export const pdfStats = (g.__pdfStats ??= { activos: 0, enCola: 0, cacheHits: 0, generados: 0 });
