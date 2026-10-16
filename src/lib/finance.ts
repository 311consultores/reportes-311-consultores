import type { InvoiceKind, PaymentAccount, Prisma } from "@prisma/client";

/** Todo el dinero se maneja en centavos enteros (nunca con decimales flotantes) y se guarda como DECIMAL(12,2). */
export const VAT_PERCENT = 16;
/** Cookie que recuerda (por un día) que se cerró el aviso de vencidas. */
export const OVERDUE_COOKIE = "venc_cierre";
export const MAX_CENTS = 9_999_999_999; // $99,999,999.99

/** Convierte lo que escribe el usuario ("$1,234.50") a centavos. Devuelve null si no es válido o no es mayor que cero. */
export function parseMoney(value: string): number | null {
  const clean = value.replace(/[\s$,]/g, "");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(clean)) return null;
  const [int, dec = ""] = clean.split(".");
  const cents = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return cents > 0 && cents <= MAX_CENTS ? cents : null;
}

/** IVA del 16 % redondeado al centavo (la mitad sube). */
export const vatOf = (subtotalCents: number) => Math.floor((subtotalCents * VAT_PERCENT + 50) / 100);

export const centsToDecimal = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

export const decimalToCents = (d: Prisma.Decimal | string | number) => Math.round(Number(d.toString()) * 100);

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
export const formatCents = (cents: number) => mxn.format(cents / 100);
export const formatDecimal = (d: Prisma.Decimal | string | number) => formatCents(decimalToCents(d));

// ---------- Fechas (hora de la Ciudad de México; no tiene horario de verano desde 2022) ----------
const TZ = "America/Mexico_City";
const MX_OFFSET_HOURS = 6;

/** Hoy en México como "AAAA-MM-DD". */
export const todayMx = (now = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(now);

/** Fecha "AAAA-MM-DD" como Date en UTC a medianoche (así se guardan los campos DATE). */
export const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Suma (o resta) días a una fecha "AAAA-MM-DD". */
export const addDaysIso = (iso: string, days: number) => isoDate(new Date(dateOnly(iso).getTime() + days * 86_400_000));

/** Instante en que empieza ese día en la Ciudad de México (para comparar con marcas de tiempo guardadas en UTC). */
export const mxDayStart = (iso: string) => new Date(`${iso}T0${MX_OFFSET_HOURS}:00:00.000Z`);

export const isValidIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateOnly(s).getTime()) && isoDate(dateOnly(s)) === s;

/** Rango [inicio, fin) de un mes "AAAA-MM": para campos DATE (medianoche UTC) o DATETIME (inicio del día en México). */
export function monthRange(ym: string, kind: "date" | "datetime"): { gte: Date; lt: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const h = kind === "datetime" ? MX_OFFSET_HOURS : 0;
  return { gte: new Date(Date.UTC(y, mo, 1, h)), lt: new Date(Date.UTC(y, mo + 1, 1, h)) };
}

export const fmtDate = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDateTime = (d: Date) => d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: TZ });

// ---------- Cuentas receptoras ----------
export type AccountInfo = { value: PaymentAccount; label: string; type: "EFECTIVO" | "BANCO"; kinds: InvoiceKind[] };

export const ACCOUNTS: AccountInfo[] = [
  { value: "CAJA_CHICA", label: "Caja chica", type: "EFECTIVO", kinds: ["RECIBO"] },
  { value: "TRIADA", label: "Triada", type: "BANCO", kinds: ["FACTURA"] },
  { value: "JOHNNY_EFECTIVO", label: "Johnny (efectivo)", type: "EFECTIVO", kinds: ["RECIBO"] },
  { value: "JOHNNY_TRANS", label: "Johnny (transferencia)", type: "BANCO", kinds: ["FACTURA", "RECIBO"] },
  { value: "YISUS_EFECTIVO", label: "Yisus (efectivo)", type: "EFECTIVO", kinds: ["RECIBO"] },
  { value: "YISUS_TRANS", label: "Yisus (transferencia)", type: "BANCO", kinds: ["FACTURA", "RECIBO"] },
];

export const accountsFor = (kind: InvoiceKind) => ACCOUNTS.filter((a) => a.kinds.includes(kind));
export const accountLabel = (v: PaymentAccount | null | undefined) => ACCOUNTS.find((a) => a.value === v)?.label ?? "—";

export const KIND_LABEL: Record<InvoiceKind, string> = { FACTURA: "Factura", RECIBO: "Recibo simple" };

// ---------- Estatus ----------
export type DisplayStatus = "ENVIADA" | "PAGADA" | "VENCIDA";
export const STATUS_LABEL: Record<DisplayStatus, string> = { ENVIADA: "Enviada", PAGADA: "Pagada", VENCIDA: "Vencida" };

/** "Vencida" no se guarda: es una Enviada cuya fecha límite ya pasó (la fecha límite en sí todavía no está vencida). */
export function displayStatus(inv: { status: "ENVIADA" | "PAGADA"; dueDate: Date }, today = todayMx()): DisplayStatus {
  if (inv.status === "PAGADA") return "PAGADA";
  return isoDate(inv.dueDate) < today ? "VENCIDA" : "ENVIADA";
}
