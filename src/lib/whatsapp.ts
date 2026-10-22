/** Deja solo los dígitos del teléfono; los de 10 dígitos se toman como México (+52). Devuelve null si no parece un teléfono. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `52${d}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Sofía». */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Mensaje para copiar y pegar en WhatsApp: «Hola Ana y Luis te acabo de asignar la tarea: …, puedes verla dando click aquí: …». */
export function taskAssignMessage(fullNames: string[], title: string, url: string): string {
  const firsts = fullNames.map((n) => n.trim().split(/\s+/)[0] || n);
  return `Hola ${joinNames(firsts)} te acabo de asignar la tarea: ${title}, puedes verla dando click aquí: ${url}`;
}
