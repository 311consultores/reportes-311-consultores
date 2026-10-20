/** Tipos de aviso que se pueden activar o desactivar por dispositivo (notificaciones del navegador). */
export type PushGroup = { id: string; label: string; kinds: string[]; ops?: boolean };

export const PUSH_GROUPS: PushGroup[] = [
  { id: "asignada", label: "Tareas asignadas o con cambio de fecha", kinds: ["TASK_ASSIGNED"] },
  { id: "revision", label: "Tareas listas para revisar, devueltas o aceptadas", kinds: ["TASK_READY", "TASK_RETURNED", "TASK_ACCEPTED"] },
  { id: "chat", label: "Mensajes del chat de las tareas", kinds: ["TASK_MESSAGE"] },
  { id: "fechas", label: "Tareas por vencer o vencidas", kinds: ["TASK_SOON", "TASK_OVERDUE"] },
  { id: "reportes", label: "Solicitudes de edición de reportes y registros de clientes nuevos", kinds: ["EDIT_REQUEST", "REGISTRATION"], ops: true },
  { id: "facturas", label: "Facturas vencidas", kinds: ["INVOICE_OVERDUE"], ops: true },
  { id: "baul", label: "Notas del Baúl compartidas contigo y recordatorios", kinds: ["NOTE_SHARED", "NOTE_REMINDER"] },
];
