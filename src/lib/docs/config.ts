// Configuración del módulo Documentos (solo servidor): datos de la empresa, cargos y personas que reciben pagos.
import { getSetting, setSetting } from "@/lib/branding";
import { DEFAULT_CONFIG, type DocsConfig, type Empresa } from "@/lib/docs/types";

const KEY = "docs_config";

export async function getDocsConfig(): Promise<DocsConfig> {
  try {
    const raw = JSON.parse((await getSetting(KEY)) ?? "{}") as Partial<DocsConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      cargos: Array.isArray(raw.cargos) && raw.cargos.length ? raw.cargos : DEFAULT_CONFIG.cargos,
      recibe: Array.isArray(raw.recibe) ? raw.recibe : [],
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export const saveDocsConfig = (c: DocsConfig) => setSetting(KEY, JSON.stringify(c));

export const empresaOf = (c: DocsConfig): Empresa => ({
  razonSocial: c.razonSocial, domicilio: c.domicilio, rfc: c.rfc, repNombre: c.repNombre, repDomicilio: c.repDomicilio, repIne: c.repIne, ciudad: c.ciudad,
});

/** Datos de la empresa que faltan para poder hacer contratos y acuerdos (lista vacía = todo listo). */
export function missingEmpresa(c: Empresa): string[] {
  const need: [keyof Empresa, string][] = [
    ["razonSocial", "razón social"], ["domicilio", "domicilio"], ["rfc", "RFC"], ["repNombre", "nombre del representante"], ["repDomicilio", "domicilio del representante"], ["repIne", "INE del representante"],
  ];
  return need.filter(([k]) => !c[k].trim()).map(([, label]) => label);
}
