/**
 * Datos fiscales y de contacto de un cliente. La misma validación se usa en el formulario público de registro,
 * en la revisión del registro y en la edición del perfil del cliente.
 */
export const PRIVACY_URL = "https://311consultores.com/privacidad/";
export const CONSTANCIA_MAX_BYTES = 5 * 1024 * 1024;

const RFC_MORAL = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/; // persona moral: 12 caracteres
const RFC_FISICA = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/; // persona física: 13 caracteres
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ClientData = {
  companyName: string;
  requiresInvoice: boolean;
  legalName: string | null;
  rfc: string | null;
  street: string | null;
  colonia: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  billingName: string;
  billingPhone: string;
  billingEmail: string;
};

type Raw = { get(name: string): FormDataEntryValue | null };

const clean = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export const isValidRfc = (rfc: string) => RFC_MORAL.test(rfc) || RFC_FISICA.test(rfc);

/** Devuelve el teléfono a 10 dígitos (acepta espacios, guiones, paréntesis y lada +52), o null si no es válido. */
export function normalizePhone(value: string): string | null {
  let d = value.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("52")) d = d.slice(2);
  return d.length === 10 ? d : null;
}

export function parseClientData(raw: Raw): { ok: true; data: ClientData } | { ok: false; error: string } {
  const companyName = clean(raw.get("companyName"));
  if (companyName.length < 2) return { ok: false, error: "Escribe el nombre de la empresa" };
  if (companyName.length > 150) return { ok: false, error: "El nombre de la empresa es demasiado largo" };

  const requiresInvoice = ["on", "true", "1"].includes(clean(raw.get("requiresInvoice")));
  const legalName = clean(raw.get("legalName"));
  const rfc = clean(raw.get("rfc")).toUpperCase().replace(/\s/g, "");
  const street = clean(raw.get("street"));
  const colonia = clean(raw.get("colonia"));
  const postalCode = clean(raw.get("postalCode"));
  const city = clean(raw.get("city"));
  const state = clean(raw.get("state"));

  if (requiresInvoice) {
    if (legalName.length < 3) return { ok: false, error: "Escribe la razón social para facturar" };
    if (!rfc) return { ok: false, error: "Escribe el RFC" };
    for (const [v, label] of [[street, "la calle y número"], [colonia, "la colonia"], [postalCode, "el código postal"], [city, "la ciudad"], [state, "el estado"]] as const) {
      if (!v) return { ok: false, error: `Escribe ${label} de la dirección fiscal` };
    }
  }
  if (rfc && !isValidRfc(rfc)) return { ok: false, error: "El RFC no tiene un formato válido (12 caracteres para persona moral, 13 para persona física)" };
  if (postalCode && !/^\d{5}$/.test(postalCode)) return { ok: false, error: "El código postal debe tener 5 dígitos" };

  type Contact = { error: string } | { name: string; phone: string; email: string };
  const contact = (prefix: "contact" | "billing", label: string): Contact => {
    const name = clean(raw.get(`${prefix}Name`));
    const phone = normalizePhone(clean(raw.get(`${prefix}Phone`)));
    const email = clean(raw.get(`${prefix}Email`)).toLowerCase();
    if (name.length < 2) return { error: `${label}: escribe el nombre` };
    if (!phone) return { error: `${label}: el teléfono debe tener 10 dígitos` };
    if (!EMAIL.test(email) || email.length > 191) return { error: `${label}: el correo no es válido` };
    return { name, phone, email };
  };
  const c = contact("contact", "Contacto principal");
  if ("error" in c) return { ok: false, error: c.error };
  const b = contact("billing", "Contacto de administración y facturación");
  if ("error" in b) return { ok: false, error: b.error };

  return {
    ok: true,
    data: {
      companyName,
      requiresInvoice,
      legalName: legalName || null,
      rfc: rfc || null,
      street: street || null,
      colonia: colonia || null,
      postalCode: postalCode || null,
      city: city || null,
      state: state || null,
      contactName: c.name,
      contactPhone: c.phone,
      contactEmail: c.email,
      billingName: b.name,
      billingPhone: b.phone,
      billingEmail: b.email,
    },
  };
}

/** PDF de la Constancia de Situación Fiscal: hasta 5 MB, comprobando el contenido real del archivo. */
export async function validateConstancia(file: File): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  if (file.size > CONSTANCIA_MAX_BYTES) return { ok: false, error: "La constancia no debe pesar más de 5 MB" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 4).toString() !== "%PDF") return { ok: false, error: "La constancia debe ser un archivo PDF" };
  return { ok: true, buf };
}
