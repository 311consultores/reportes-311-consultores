import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/branding";
import type { CurrentUser } from "@/lib/auth";
import { dateOnly, isValidIsoDate, monthRange, todayMx } from "@/lib/finance";

/** Los clientes solo ven las facturas y recibos de su empresa. */
export function invoiceScope(user: CurrentUser): Prisma.InvoiceWhereInput {
  if (user.role === "ADMIN" || user.role === "EDITOR") return {};
  if (user.role === "TEAM_311") return { id: "sin-acceso" }; // el TEAM 311 no ve facturas
  return { clientId: { in: user.clientAccess.map((c) => c.clientId) } };
}

export type InvoiceFilters = {
  estado: "" | "ENVIADA" | "PAGADA" | "VENCIDA";
  tipo: "" | "FACTURA" | "RECIBO";
  cliente: string;
  fecha: "creacion" | "envio" | "cobro";
  mes: string; // AAAA-MM
  q: string;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp: Record<string, string | string[] | undefined>): InvoiceFilters {
  const estado = first(sp.estado);
  const tipo = first(sp.tipo);
  const fecha = first(sp.fecha);
  return {
    estado: estado === "ENVIADA" || estado === "PAGADA" || estado === "VENCIDA" ? estado : "",
    tipo: tipo === "FACTURA" || tipo === "RECIBO" ? tipo : "",
    cliente: /^[0-9a-f-]{36}$/i.test(first(sp.cliente)) ? first(sp.cliente) : "",
    fecha: fecha === "envio" || fecha === "cobro" ? fecha : "creacion",
    mes: monthRange(first(sp.mes), "date") ? first(sp.mes) : "",
    q: first(sp.q).trim().slice(0, 80),
  };
}

/** Condiciones de la lista a partir de los filtros (sin el estado: ese se aplica aparte para poder calcular los KPI). */
export function filtersToWhere(f: InvoiceFilters): Prisma.InvoiceWhereInput {
  const and: Prisma.InvoiceWhereInput[] = [];
  if (f.tipo) and.push({ kind: f.tipo });
  if (f.cliente) and.push({ clientId: f.cliente });
  if (f.mes) {
    const r = monthRange(f.mes, f.fecha === "cobro" ? "date" : "datetime"); // el cobro es una fecha sin hora
    if (r) and.push(f.fecha === "cobro" ? { collectedOn: r } : f.fecha === "envio" ? { sentAt: r } : { createdAt: r });
  }
  if (f.q) {
    and.push({ OR: [{ description: { contains: f.q } }, { number: { contains: f.q } }, { client: { companyName: { contains: f.q } } }] });
  }
  return and.length ? { AND: and } : {};
}

export function statusWhere(estado: InvoiceFilters["estado"], today = todayMx()): Prisma.InvoiceWhereInput {
  const t = dateOnly(today);
  if (estado === "PAGADA") return { status: "PAGADA" };
  if (estado === "ENVIADA") return { status: "ENVIADA", dueDate: { gte: t } };
  if (estado === "VENCIDA") return { status: "ENVIADA", dueDate: { lt: t } };
  return {};
}

/** Facturas y recibos vencidos (Enviada con fecha límite pasada) para el aviso fijo y el correo diario. */
export async function overdueSummary(today = todayMx()) {
  const where: Prisma.InvoiceWhereInput = { status: "ENVIADA", dueDate: { lt: dateOnly(today) } };
  const [count, sum] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({ where, _sum: { total: true } }),
  ]);
  return { count, total: sum._sum.total };
}

// ---------- Datos bancarios (los captura el Admin; no van en el código) ----------
export type BankAccount = {
  title: string; // p. ej. "FACTURA TRIADA"
  holder: string;
  rfc: string;
  bank: string;
  clabe: string;
  account: string;
  card: string;
};

const BANK_KEY = "datos_bancarios";
const BANK_FIELDS = ["title", "holder", "rfc", "bank", "clabe", "account", "card"] as const;
const BANK_MAX = { title: 80, holder: 120, rfc: 13, bank: 60, clabe: 18, account: 30, card: 25 } as const;

export function cleanBankAccounts(raw: unknown): BankAccount[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    const acc = Object.fromEntries(
      BANK_FIELDS.map((k) => [k, (typeof o[k] === "string" ? (o[k] as string) : "").replace(/\s+/g, " ").trim().slice(0, BANK_MAX[k])]),
    ) as BankAccount;
    acc.rfc = acc.rfc.toUpperCase();
    return acc.title ? [acc] : [];
  });
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  try {
    return cleanBankAccounts(JSON.parse((await getSetting(BANK_KEY)) ?? "[]"));
  } catch {
    return [];
  }
}

export const saveBankAccounts = (accounts: BankAccount[]) => setSetting(BANK_KEY, JSON.stringify(accounts));

/** Texto listo para pegar (WhatsApp, correo…) con los datos de una cuenta. */
export function bankAccountText(a: BankAccount): string {
  return [
    a.title,
    a.holder,
    a.rfc && `RFC: ${a.rfc}`,
    a.bank && `BANCO: ${a.bank}`,
    a.clabe && `CLABE: ${a.clabe}`,
    a.account && `CTA: ${a.account}`,
    a.card && `TARJETA: ${a.card}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export { isValidIsoDate };
