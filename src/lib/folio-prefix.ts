/** Prefijo sugerido: las 3 primeras letras del nombre, en mayúsculas y sin acentos (La Jaula... da LAJ). */
export function suggestPrefix(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}
