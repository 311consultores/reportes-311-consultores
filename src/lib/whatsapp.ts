/** Deja solo los dígitos del teléfono; los de 10 dígitos se toman como México (+52). Devuelve null si no parece un teléfono. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `52${d}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

/** Enlace de WhatsApp con el mensaje ya escrito. Sin teléfono, WhatsApp deja elegir el contacto. */
export function whatsappUrl(phone: string | null | undefined, text: string): string {
  const n = normalizePhone(phone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`;
}

/** Mensaje al asignar una tarea: «Hola Ana te acabo de asignar la tarea: …, puedes verla dando click aquí: …». */
export function taskAssignMessage(fullName: string, title: string, url: string): string {
  const first = fullName.trim().split(/\s+/)[0] || fullName;
  return `Hola ${first} te acabo de asignar la tarea: ${title}, puedes verla dando click aquí: ${url}`;
}
