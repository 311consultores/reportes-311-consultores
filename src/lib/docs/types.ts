// Datos de los documentos. Lo capturado se guarda como JSON en Document.data; los datos de la empresa se copian al documento
// al crearlo para que, aunque cambie la configuración, un documento ya hecho se vea igual.
import type { DocKind } from "@prisma/client";

export type Empresa = {
  razonSocial: string;
  domicilio: string;
  rfc: string;
  repNombre: string;
  repDomicilio: string;
  repIne: string;
  ciudad: string; // «Mérida, Yucatán, México»
};

export type Persona = { nombre: string; firmaKey?: string | null };

export type DocsConfig = Empresa & {
  cargos: string[]; // cargos que puede tener quien firma por la empresa
  recibe: Persona[]; // personas autorizadas para «Confirma de recibido» (con firma escaneada opcional)
  bcc: string; // copia oculta de cada envío
  emailRescision: string; // correo al que se notifica la rescisión por falta de pago (contratos)
  contactEmail: string; // contacto que aparece en el pie de los reportes y recibos
  contactPhones: string; // teléfonos del pie, ya con el formato a mostrar
};

/** Lema que cierra el pie de los reportes. */
export const FOOTER_SLOGAN = "Personas, procesos y tecnología en armonía.";

export const DEFAULT_CONFIG: DocsConfig = {
  razonSocial: "", domicilio: "", rfc: "", repNombre: "", repDomicilio: "", repIne: "", ciudad: "Mérida, Yucatán, México",
  cargos: ["Director de Marketing", "Consultor de Marketing"],
  recibe: [],
  bcc: "necesito@311consultores.com",
  emailRescision: "",
  contactEmail: "necesito@311consultores.com",
  contactPhones: "999 136 4441 · 999 111 8063",
};

export type RepLegal = { nombre: string; domicilio: string; curp: string; ine: string; rol: string };
export type ClienteDoc = { razon: string; domicilio: string };

export type AcuerdoData = {
  kind: "ACUERDO";
  empresa: Empresa;
  fecha: string; // AAAA-MM-DD
  cliente: ClienteDoc;
  rep: RepLegal;
  cargoEmpresa: string;
  meses: number; // duración del acuerdo
  anios: number; // años adicionales de confidencialidad
  penaCents: number; // pena convencional
  extra?: { titulo: string; texto: string } | null; // cláusula adicional
};

export type Concepto = { desc: string; cents: number };

export type ReciboData = {
  kind: "RECIBO";
  fecha: string;
  clienteNombre: string; // persona que paga (opcional)
  clienteEmpresa: string;
  conceptos: Concepto[];
  recibe: string; // «Confirma de recibido»
  firmaKey?: string | null; // firma escaneada de quien recibe, si se incluye
};

export type PagoContrato = { mes: string; cents: number; masIva: boolean };

export type ContratoData = {
  kind: "CONTRATO";
  empresa: Empresa;
  fecha: string;
  cliente: ClienteDoc;
  rep: RepLegal;
  cargoEmpresa: string;
  ramo: string;
  servicios: string[];
  pagos: PagoContrato[];
  meses: number; // duración del contrato
  anios: number; // años de confidencialidad posteriores a la terminación
  penalidadPct: number;
  prorrogaDias: number; // días hábiles de prórroga para pagar
  emailRescision: string;
  extra?: { titulo: string; texto: string } | null;
};

export type DocData = AcuerdoData | ReciboData | ContratoData;

export const KIND_LABEL: Record<DocKind, string> = { RECIBO: "Recibo de pago", ACUERDO: "Acuerdo de confidencialidad", CONTRATO: "Contrato de prestación de servicios" };
export const KIND_SLUG: Record<DocKind, string> = { RECIBO: "recibo", ACUERDO: "acuerdo", CONTRATO: "contrato" };

export const parseDocData = (raw: string): DocData => JSON.parse(raw) as DocData;
