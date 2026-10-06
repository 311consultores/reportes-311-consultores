/** La lista de consultores se guarda como texto JSON (MariaDB no soporta arreglos nativos). */
export const serializeConsultants = (list: string[]) => JSON.stringify(list);

export function parseConsultants(stored: string): string[] {
  try {
    const v = JSON.parse(stored);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** Detalles de auditoría: se guardan como texto JSON. */
export const auditDetails = (obj: Record<string, unknown>) => JSON.stringify(obj);
