/**
 * Limpia errores comunes al pegar DATABASE_URL en un panel (cPanel): espacios o saltos de línea
 * al inicio/final y comillas envolventes. No toca nada dentro de la URL.
 */
export function cleanDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let v = raw.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}
