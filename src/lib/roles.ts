import type { Role } from "@prisma/client";

/** Nombre visible de cada rol (siempre en mayúsculas). */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "ADMINISTRADOR",
  EDITOR: "EDITOR",
  CLIENTE: "CLIENTE",
  TEAM_311: "TEAM 311",
  PROJECT_311: "PROJECT 311",
};

/** Personal interno que entra a Tareas, Baúl, Mi perfil y App y avisos. */
export const STAFF_ROLES: Role[] = ["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"];

/** Quienes gestionan las tareas: ven todas, las crean, editan, asignan y aceptan. */
export const TASK_MANAGER_ROLES: Role[] = ["ADMIN", "EDITOR", "PROJECT_311"];

/** Personas a quienes se les puede asignar una tarea. */
export const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "EDITOR", "PROJECT_311", "TEAM_311"];

export const isTaskManager = (role: Role) => TASK_MANAGER_ROLES.includes(role);
