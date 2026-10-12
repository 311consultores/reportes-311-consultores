"use client";

import { useState } from "react";

export type ClientFieldValues = {
  companyName: string;
  requiresInvoice: boolean;
  legalName: string;
  rfc: string;
  street: string;
  colonia: string;
  postalCode: string;
  city: string;
  state: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  billingName: string;
  billingPhone: string;
  billingEmail: string;
};

export const EMPTY_CLIENT_VALUES: ClientFieldValues = {
  companyName: "", requiresInvoice: false, legalName: "", rfc: "", street: "", colonia: "", postalCode: "", city: "", state: "",
  contactName: "", contactPhone: "", contactEmail: "", billingName: "", billingPhone: "", billingEmail: "",
};

type Props = {
  defaults?: Partial<ClientFieldValues>;
  /** Campo para subir el logo (formulario público). */
  showLogo?: boolean;
  /** Campo para subir la constancia (solo aparece cuando requiere factura). */
  showConstancia?: boolean;
  /** Enlace a la constancia ya guardada (perfil y revisión). */
  constanciaHref?: string | null;
  onCompanyName?: (name: string) => void;
};

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="label">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/10">
    <legend className="px-2 text-sm font-semibold tracking-tight">{title}</legend>
    {children}
  </fieldset>
);

/**
 * Campos de datos del cliente: empresa, facturación, dirección y los dos contactos.
 * Los valores viajan en el formulario con sus nombres (companyName, rfc, contactEmail...).
 */
export function ClientDataFields({ defaults, showLogo, showConstancia, constanciaHref, onCompanyName }: Props) {
  const [v, setV] = useState<ClientFieldValues>({ ...EMPTY_CLIENT_VALUES, ...defaults });
  const [same, setSame] = useState(false);
  const set = <K extends keyof ClientFieldValues>(k: K, value: ClientFieldValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const text = (k: Exclude<keyof ClientFieldValues, "requiresInvoice">) => ({
    name: k,
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
  });

  // «Misma persona»: los datos de administración se muestran copiados del contacto principal (y se envían así)
  const billing = {
    billingName: same ? v.contactName : v.billingName,
    billingPhone: same ? v.contactPhone : v.billingPhone,
    billingEmail: same ? v.contactEmail : v.billingEmail,
  };
  function toggleSame(checked: boolean) {
    if (!checked) setV((p) => ({ ...p, billingName: p.contactName, billingPhone: p.contactPhone, billingEmail: p.contactEmail }));
    setSame(checked);
  }

  const inv = v.requiresInvoice;

  return (
    <div className="space-y-6">
      <Section title="Empresa">
        <Field label="Nombre de la empresa">
          <input
            {...text("companyName")}
            required
            maxLength={150}
            className="input"
            onChange={(e) => {
              set("companyName", e.target.value);
              onCompanyName?.(e.target.value);
            }}
          />
        </Field>
        {showLogo && (
          <Field label="Logo de la empresa (opcional)" hint="PNG o JPG, hasta 2 MB.">
            <input type="file" name="logo" accept="image/png,image/jpeg" className="input" />
          </Field>
        )}
      </Section>

      <Section title="Facturación">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="requiresInvoice"
            checked={inv}
            onChange={(e) => set("requiresInvoice", e.target.checked)}
            className="h-5 w-5 accent-[#007AFF]"
          />
          Requiero factura
        </label>
        {!inv && (
          <>
            {/* Se conservan los datos fiscales ya guardados aunque se desmarque «Requiero factura» */}
            <input type="hidden" name="legalName" value={v.legalName} />
            <input type="hidden" name="rfc" value={v.rfc} />
          </>
        )}
        {inv && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Razón social para facturar">
              <input {...text("legalName")} required maxLength={255} className="input" />
            </Field>
            <Field label="RFC" hint="12 caracteres (persona moral) o 13 (persona física).">
              <input
                {...text("rfc")}
                onChange={(e) => set("rfc", e.target.value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, ""))}
                required
                maxLength={13}
                autoCapitalize="characters"
                className="input uppercase"
              />
            </Field>
            {(showConstancia || constanciaHref) && (
              <div className="md:col-span-2">
                {showConstancia && (
                  <Field label="Constancia de Situación Fiscal (opcional)" hint="Solo PDF, hasta 5 MB.">
                    <input type="file" name="constancia" accept="application/pdf" className="input" />
                  </Field>
                )}
                {constanciaHref && (
                  <a href={constanciaHref} target="_blank" rel="noreferrer" className="link mt-2 inline-block text-sm">
                    Ver constancia guardada
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title={inv ? "Dirección fiscal" : "Dirección (opcional)"}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Calle y número">
              <input {...text("street")} required={inv} maxLength={255} className="input" />
            </Field>
          </div>
          <Field label="Colonia">
            <input {...text("colonia")} required={inv} maxLength={150} className="input" />
          </Field>
          <Field label="Código postal">
            <input
              {...text("postalCode")}
              onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
              required={inv}
              inputMode="numeric"
              maxLength={5}
              className="input"
            />
          </Field>
          <Field label="Ciudad">
            <input {...text("city")} required={inv} maxLength={120} className="input" />
          </Field>
          <Field label="Estado">
            <input {...text("state")} required={inv} maxLength={120} className="input" />
          </Field>
        </div>
      </Section>

      <Section title="Contacto principal">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nombre">
            <input {...text("contactName")} required maxLength={150} className="input" />
          </Field>
          <Field label="Teléfono" hint="10 dígitos.">
            <input {...text("contactPhone")} required inputMode="tel" maxLength={16} className="input" />
          </Field>
          <Field label="Correo" hint="Aquí también se enviarán los reportes de actividades.">
            <input {...text("contactEmail")} required type="email" maxLength={191} className="input" />
          </Field>
        </div>
      </Section>

      <Section title="Contacto de administración y facturación">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={same}
            onChange={(e) => toggleSame(e.target.checked)}
            className="h-5 w-5 accent-[#007AFF]"
          />
          Es la misma persona que el contacto principal
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nombre">
            <input
              name="billingName" value={billing.billingName} readOnly={same} required maxLength={150} className="input"
              onChange={(e) => set("billingName", e.target.value)}
            />
          </Field>
          <Field label="Teléfono" hint="10 dígitos.">
            <input
              name="billingPhone" value={billing.billingPhone} readOnly={same} required inputMode="tel" maxLength={16} className="input"
              onChange={(e) => set("billingPhone", e.target.value)}
            />
          </Field>
          <Field label="Correo" hint="Solo para facturas y coordinar pagos; no recibe los reportes.">
            <input
              name="billingEmail" value={billing.billingEmail} readOnly={same} required type="email" maxLength={191} className="input"
              onChange={(e) => set("billingEmail", e.target.value)}
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
