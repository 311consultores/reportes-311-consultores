// Utilidades puras del módulo Documentos (sin base de datos): números a letra, fechas, nombres de archivo y texto enriquecido.

// ---------- Números a letra ----------
const UN = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DEC = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CEN = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

/** 1 a 999. «apocope»: «un / veintiún» en lugar de «uno / veintiuno» (cuando va antes de «mil» o «pesos»). */
function below1000(n: number, apocope: boolean): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (c) parts.push(CEN[c]);
  if (r) {
    if (r < 30) parts.push(apocope && r === 1 ? "un" : apocope && r === 21 ? "veintiún" : UN[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u ? `${DEC[d]} y ${apocope && u === 1 ? "un" : UN[u]}` : DEC[d]);
    }
  }
  return parts.join(" ");
}

/** Entero (0 a 999,999,999,999) en palabras, con «un / veintiún» cuando va antes del sustantivo. */
export function intToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999_999) throw new Error("Número fuera de rango");
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (millones) parts.push(millones === 1 ? "un millón" : `${intToWords(millones)} millones`);
  if (miles) parts.push(miles === 1 ? "mil" : `${below1000(miles, true)} mil`);
  if (resto) parts.push(below1000(resto, true));
  return parts.join(" ");
}

/** Monto en letra: «ciento ochenta mil pesos 00/100 M.N.» (con «mexicanos» si se pide). */
export function moneyWords(cents: number, opts: { capitalize?: boolean; mexicanos?: boolean } = {}): string {
  const pesos = Math.floor(cents / 100);
  const cen = String(cents % 100).padStart(2, "0");
  const de = pesos > 0 && pesos % 1_000_000 === 0 ? " de" : "";
  const noun = pesos === 1 ? "peso" : "pesos";
  const text = `${intToWords(pesos)}${de} ${noun}${opts.mexicanos ? (pesos === 1 ? " mexicano" : " mexicanos") : ""} ${cen}/100 M.N.`;
  return opts.capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
/** $22,500.00 */
export const money = (cents: number) => mxn.format(cents / 100);
/** $22,500 (sin centavos cuando son cero), como se escribe en los contratos. */
export const moneyShort = (cents: number) => (cents % 100 === 0 ? `$${(cents / 100).toLocaleString("es-MX")}` : money(cents));

// ---------- Fechas ----------
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_ABR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
};

/** 05 de Noviembre de 2026 */
export const dateLong = (iso: string) => {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")} de ${MESES[m - 1]} de ${y}`;
};
/** 08/OCT/ 26 (como en el recibo) */
export const dateReceipt = (iso: string) => {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")}/${MESES_ABR[m - 1]}/ ${String(y).slice(-2)}`;
};
/** 281026 (DDMMAA) para los nombres de archivo */
export const dateCompact = (iso: string) => {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")}${String(m).padStart(2, "0")}${String(y).slice(-2)}`;
};
/** Nombre del mes y año: «Noviembre 2026» */
export const monthYear = (iso: string) => {
  const { y, m } = parts(iso);
  return `${MESES[m - 1]} ${y}`;
};

// ---------- RFC deletreado ----------
const DIGITOS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
/** TAS2408225DA → «T, A, S, dos, cuatro, cero, ocho, dos, dos, cinco, D, A» */
export const spellRfc = (rfc: string) => rfc.trim().toUpperCase().split("").map((ch) => (/\d/.test(ch) ? DIGITOS[Number(ch)] : ch)).join(", ");

// ---------- Ordinales femeninos (cláusulas) ----------
const ORD = ["", "PRIMERA", "SEGUNDA", "TERCERA", "CUARTA", "QUINTA", "SEXTA", "SÉPTIMA", "OCTAVA", "NOVENA", "DÉCIMA"];
export const ordinal = (n: number) => (n <= 10 ? ORD[n] : n <= 19 ? `DÉCIMA ${ORD[n - 10]}` : `CLÁUSULA ${n}`);

// ---------- Texto ----------
/** Quita lo que las fuentes del PDF no pueden dibujar (letras modificadoras, comillas raras, espacios especiales). */
export function cleanText(s: string): string {
  return s
    .replace(/ᴬ/g, "A")
    .replace(/[ -​  ]/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Nombre de archivo seguro (sin extensión). */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);

export type Run = { t: string; b?: boolean; i?: boolean };

/** «Texto **en negritas** y _cursivas_» → partes con formato. */
export function rich(s: string): Run[] {
  const out: Run[] = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > last) out.push({ t: s.slice(last, m.index) });
    out.push(m[1] !== undefined ? { t: m[1], b: true } : { t: m[2], i: true });
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out;
}

// ---------- Correos ----------
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const parseEmails = (raw: string): string[] => [...new Set(raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
export const invalidEmails = (list: string[]) => list.filter((e) => !EMAIL.test(e));

// ---------- Modelo de documento de texto (contratos y acuerdos) ----------
export type DocBlock =
  | { k: "title"; t: string }
  | { k: "center"; t: string; b?: boolean } // línea centrada (REUNIDOS, INTERVIENEN…)
  | { k: "h"; r: Run[] } // encabezado de cláusula
  | { k: "p"; r: Run[]; align?: "j" | "l" | "r" | "c"; indent?: number }
  | { k: "li"; r: Run[]; mark: string }
  | { k: "sign"; cols: { lines: string[] }[] }
  | { k: "space"; h?: number };

export type TextDoc = { title: string; blocks: DocBlock[] };
