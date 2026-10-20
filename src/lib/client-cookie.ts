/** Guarda una cookie sencilla (por un año) desde el navegador, para recordar preferencias como la pestaña elegida. */
export function setPreference(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
