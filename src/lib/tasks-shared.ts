/** Utilidades del panel de tareas que se usan en el servidor y en el navegador (sin acceso a la base de datos). */
import type { Role, TaskStatus } from "@prisma/client";

export const TZ = "America/Mexico_City";
const MX_OFFSET = "-06:00"; // México ya no tiene horario de verano

export const STATUS_ORDER: TaskStatus[] = ["PENDIENTE", "EN_PROCESO", "PARA_REVISAR", "TERMINADA"];

export const STATUS_INFO: Record<TaskStatus, { label: string; emoji: string; hint: string; dot: string }> = {
  PENDIENTE: { label: "PENDIENTE", emoji: "📝", hint: "Aquí nacen las tareas", dot: "#8E8E93" },
  EN_PROCESO: { label: "EN PROCESO", emoji: "🚀", hint: "Ya se está trabajando", dot: "#007AFF" },
  PARA_REVISAR: { label: "PARA REVISAR", emoji: "🔍", hint: "Esperando revisión", dot: "#FF9500" },
  TERMINADA: { label: "TERMINADA", emoji: "🎉", hint: "Aceptada", dot: "#34C759" },
};

/** Días que una tarea terminada permanece en el tablero antes de ocultarse sola. */
export const FINISHED_VISIBLE_DAYS = 15;

/** Fecha límite: las terminadas aceptadas antes de esta fecha ya no aparecen en el tablero. */
export const finishedCutoff = () => new Date(Date.now() - FINISHED_VISIBLE_DAYS * 86_400_000);

/** Valor para <input type="datetime-local"> (hora de México) a partir de una fecha. */
export function toMxInput(d: Date): string {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return p.replace(" ", "T").slice(0, 16);
}

/** Convierte lo que se escribió en un <input type="datetime-local"> (hora de México) en una fecha real; null si no es válida. */
export function parseMxInput(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const d = new Date(`${s}:00${MX_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatMx(d: Date | string, withTime = true): string {
  return new Date(d).toLocaleString("es-MX", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}) });
}

/** Fecha por defecto de entrega: 48 horas corridas a partir de ahora. */
export const defaultDue = (now: Date = new Date()) => new Date(now.getTime() + 48 * 3600_000);

/** Fecha (AAAA-MM-DD) de un instante, en hora de México. */
export const dayKey = (d: Date | string) => toMxInput(new Date(d)).slice(0, 10);

/** Primer instante del mes actual en hora de México (para la racha mensual). */
export const mxMonthStart = (now: Date = new Date()) => new Date(`${dayKey(now).slice(0, 7)}-01T00:00:00${MX_OFFSET}`);

export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Insignias de la racha mensual de tareas aceptadas. */
export const STREAK_BADGES = [
  { at: 5, emoji: "⭐", label: "5 tareas aceptadas" },
  { at: 10, emoji: "🏆", label: "10 tareas aceptadas" },
];

/** «Te quedan 1 d 4 h» / «Vencida hace 3 h». */
export function remainingText(due: Date | string, now: Date): { text: string; overdue: boolean } {
  const ms = new Date(due).getTime() - now.getTime();
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const parts = d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${Math.max(m, 1)} min`;
  return ms >= 0 ? { text: `Te quedan ${parts}`, overdue: false } : { text: `Vencida hace ${parts}`, overdue: true };
}

/** Estado de la fecha de entrega para la tarjeta: vencida (rojo), por vencer en 12 h (naranja) o normal. */
export function dueState(status: TaskStatus, due: Date | string, now: Date): "overdue" | "soon" | "ok" {
  if (status === "PARA_REVISAR" || status === "TERMINADA") return "ok";
  const ms = new Date(due).getTime() - now.getTime();
  return ms < 0 ? "overdue" : ms <= 12 * 3600_000 ? "soon" : "ok";
}

/** ¿Puede este usuario mover una tarea entre estas fases? (el servidor vuelve a comprobarlo) */
export function canMove(role: Role, isAssignee: boolean, from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return false;
  if (role === "ADMIN" || role === "EDITOR") return true;
  if (role !== "TEAM_311" || !isAssignee) return false;
  if (from === "PENDIENTE") return to === "EN_PROCESO" || to === "PARA_REVISAR";
  if (from === "EN_PROCESO") return to === "PENDIENTE" || to === "PARA_REVISAR";
  return false; // Para revisar y Terminada: solo consulta
}

export const EVENT_LABEL: Record<string, string> = {
  CREATED: "Creó la tarea",
  MOVED: "Movió la tarea",
  READY: "Marcó la tarea como lista",
  ACCEPTED: "Aceptó la tarea",
  RETURNED: "Devolvió la tarea para corregir",
  EDITED: "Editó la tarea",
};
