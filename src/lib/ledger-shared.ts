// Parte "pura" de las cajas: no usa base de datos ni archivos, así que puede importarse también desde componentes de pantalla.
import type { Box, CashType } from "@prisma/client";

// ---------- Cajas ----------
export type BoxInfo = { value: Box; label: string; group: "operativa" | "iva" | "socio"; hint: string };

export const BOXES: BoxInfo[] = [
  { value: "NOMINA", label: "Nómina", group: "operativa", hint: "Pago semanal de nómina" },
  { value: "AHORRO", label: "Ahorro", group: "operativa", hint: "" },
  { value: "NAVIDAD", label: "Navidad", group: "operativa", hint: "" },
  { value: "GASTOS", label: "Gastos (caja chica)", group: "operativa", hint: "Gastos generales" },
  { value: "UTILIDAD", label: "Utilidad", group: "operativa", hint: "Remanente después de repartir a los socios" },
  { value: "DEV", label: "Desarrollo (DEV)", group: "operativa", hint: "30 % de proyectos de software" },
  { value: "IMPUESTOS", label: "Impuestos", group: "iva", hint: "Parte del IVA para impuestos" },
  { value: "MARKETING", label: "Marketing", group: "iva", hint: "Parte del IVA para marketing" },
  { value: "GANANCIA_INTERNA", label: "Ganancia interna", group: "iva", hint: "Parte del IVA que se queda aparte" },
  { value: "UTILIDAD_JOHNNY", label: "Utilidad individual · Johnny", group: "socio", hint: "" },
  { value: "UTILIDAD_YISUS", label: "Utilidad individual · Yisus", group: "socio", hint: "" },
];

export const boxLabel = (b: Box) => BOXES.find((x) => x.value === b)?.label ?? b;
export const CASH_LABEL: Record<CashType, string> = { EFECTIVO: "Efectivo", BANCO: "Banco" };
export const isBox = (v: string): v is Box => BOXES.some((b) => b.value === v);
export const isCash = (v: string): v is CashType => v === "EFECTIVO" || v === "BANCO";

// ---------- Porcentajes (en puntos base: 4500 = 45.00 %) ----------
export type SplitConfig = {
  nomina: number;
  ahorro: number;
  navidad: number;
  gastos: number;
  dev: number; // solo proyectos de software
  ivaImpuestos: number;
  ivaMarketing: number;
  ivaGanancia: number;
  socio: number; // parte de la utilidad que recibe CADA socio
};

export const DEFAULT_SPLIT: SplitConfig = {
  nomina: 4500, ahorro: 300, navidad: 200, gastos: 1000, dev: 3000, ivaImpuestos: 5000, ivaMarketing: 2500, ivaGanancia: 2500, socio: 5000,
};

export const SPLIT_FIELDS: { key: keyof SplitConfig; label: string; group: string }[] = [
  { key: "nomina", label: "Nómina", group: "Sobre el ingreso neto" },
  { key: "ahorro", label: "Ahorro", group: "Sobre el ingreso neto" },
  { key: "navidad", label: "Navidad", group: "Sobre el ingreso neto" },
  { key: "gastos", label: "Gastos (caja chica)", group: "Sobre el ingreso neto" },
  { key: "dev", label: "DEV (solo proyectos de software)", group: "Sobre el ingreso neto" },
  { key: "ivaImpuestos", label: "Impuestos", group: "División del IVA (debe sumar 100 %)" },
  { key: "ivaGanancia", label: "Ganancia interna", group: "División del IVA (debe sumar 100 %)" },
  { key: "ivaMarketing", label: "Marketing", group: "División del IVA (debe sumar 100 %)" },
  { key: "socio", label: "Para cada socio (de la utilidad)", group: "Utilidad individual" },
];

export function validateSplit(c: SplitConfig): string | null {
  for (const k of Object.keys(DEFAULT_SPLIT) as (keyof SplitConfig)[]) {
    if (!Number.isInteger(c[k]) || c[k] < 0 || c[k] > 10000) return "Cada porcentaje debe estar entre 0 y 100";
  }
  if (c.nomina + c.ahorro + c.navidad + c.gastos + c.dev > 10000) return "Nómina, ahorro, navidad, gastos y DEV no pueden sumar más de 100 %";
  if (c.ivaImpuestos + c.ivaMarketing + c.ivaGanancia !== 10000) return "La división del IVA debe sumar exactamente 100 %";
  if (c.socio * 2 > 10000) return "Entre los dos socios no pueden recibir más del 100 % de la utilidad";
  return null;
}

export const bpsToPercent = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, "");

export function percentToBps(text: string): number | null {
  const clean = text.replace(/[\s%]/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(clean)) return null;
  const bps = Math.round(Number(clean) * 100);
  return bps >= 0 && bps <= 10000 ? bps : null;
}

// ---------- Reparto de un cobro (función pura) ----------
export type Line = { box: Box; cents: number };

const pct = (base: number, bps: number) => Math.floor((base * bps) / 10000);

/**
 * Reparte un cobro. Los porcentajes se calculan sobre el ingreso neto (subtotal). Lo que queda es la utilidad,
 * de la que cada socio recibe su parte; el sobrante de redondeo se queda en la caja Utilidad. El IVA se divide
 * aparte. La suma de las líneas es siempre exactamente igual al total cobrado.
 */
export function computeDistribution(p: { subtotal: number; vat: number; isSoftware: boolean }, cfg: SplitConfig): Line[] {
  const net = p.subtotal;
  const dev = p.isSoftware ? pct(net, cfg.dev) : 0;
  const nomina = pct(net, cfg.nomina);
  const ahorro = pct(net, cfg.ahorro);
  const navidad = pct(net, cfg.navidad);
  const gastos = pct(net, cfg.gastos);
  const utilidad = net - dev - nomina - ahorro - navidad - gastos;
  if (utilidad < 0) throw new Error("Los porcentajes configurados superan el ingreso neto");
  const socio = pct(utilidad, cfg.socio);
  const impuestos = pct(p.vat, cfg.ivaImpuestos);
  const marketing = pct(p.vat, cfg.ivaMarketing);
  const ganancia = p.vat - impuestos - marketing;

  const lines: Line[] = [
    { box: "DEV", cents: dev },
    { box: "NOMINA", cents: nomina },
    { box: "AHORRO", cents: ahorro },
    { box: "NAVIDAD", cents: navidad },
    { box: "GASTOS", cents: gastos },
    { box: "UTILIDAD", cents: utilidad - 2 * socio },
    { box: "UTILIDAD_JOHNNY", cents: socio },
    { box: "UTILIDAD_YISUS", cents: socio },
    { box: "IMPUESTOS", cents: impuestos },
    { box: "MARKETING", cents: marketing },
    { box: "GANANCIA_INTERNA", cents: ganancia },
  ];
  return lines.filter((l) => l.cents !== 0);
}

// ---------- Saldos ----------
export const key = (box: Box, type: CashType) => `${box}:${type}`;
export type Balances = Map<string, number>;
export const balanceOf = (b: Balances, box: Box, type: CashType) => b.get(key(box, type)) ?? 0;

/** Primer saldo que quedaría negativo si se aplican estos cambios (null si todo queda en cero o más). */
export function firstNegative(current: Balances, changes: { box: Box; cashType: CashType; cents: number }[]): string | null {
  const next = new Map(current);
  for (const c of changes) next.set(key(c.box, c.cashType), (next.get(key(c.box, c.cashType)) ?? 0) + c.cents);
  for (const c of changes) {
    if ((next.get(key(c.box, c.cashType)) ?? 0) < 0) return `${boxLabel(c.box)} (${CASH_LABEL[c.cashType].toLowerCase()})`;
  }
  return null;
}

// ---------- Instantánea del reparto guardada en la factura ----------
export type DistributionSnapshot = { cfg: SplitConfig; cashType: CashType; total: number; lines: Line[] };

export const parseSnapshot = (raw: string | null): DistributionSnapshot | null => {
  try {
    return raw ? (JSON.parse(raw) as DistributionSnapshot) : null;
  } catch {
    return null;
  }
};
