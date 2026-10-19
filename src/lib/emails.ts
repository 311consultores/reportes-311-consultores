const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

export const isEmail = (s: string) => EMAIL.test(s) && s.length <= 191;

/** Separa una lista de correos (por coma, punto y coma, espacios o saltos de línea). */
export const splitEmails = (s: string | null | undefined) => (s ?? "").split(/[,;\s]+/).filter(Boolean);

/** Quita duplicados sin importar mayúsculas y devuelve los correos en minúsculas. */
export const uniqueEmails = (list: string[]) => Array.from(new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean)));
