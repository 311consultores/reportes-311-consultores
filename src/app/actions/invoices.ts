"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { InvoiceKind, PaymentAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  accountsFor, centsToDecimal, dateOnly, decimalToCents, isValidIsoDate, parseMoney, todayMx, vatOf,
} from "@/lib/finance";
import { cleanBankAccounts, saveBankAccounts } from "@/lib/invoices";
import {
  computeDistribution, firstNegative, getBalances, getSplitConfig, writeEntries, type DistributionSnapshot,
} from "@/lib/ledger";

type State = { error?: string; ok?: boolean } | undefined;

const log = (invoiceId: string, userId: string, action: string, details?: unknown) =>
  prisma.invoiceLog.create({ data: { invoiceId, userId, action, details: details ? JSON.stringify(details) : null } });

const common = {
  description: z.string().trim().min(3, "Escribe la descripción").max(500, "La descripción es demasiado larga"),
  subtotal: z.string(),
  dueDate: z.string().refine(isValidIsoDate, "Indica la fecha límite de pago"),
  number: z.string().trim().max(60, "El número es demasiado largo").optional(),
};

/** Registra una factura o un recibo simple que ya se envió al cliente. */
export async function createInvoice(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z
    .object({ kind: z.enum(["FACTURA", "RECIBO"]), clientId: z.string().uuid("Selecciona un cliente"), ...common })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const subtotal = parseMoney(d.subtotal);
  if (subtotal === null) return { error: "El subtotal debe ser un monto mayor a cero (por ejemplo 12500.50)" };

  const client = await prisma.client.findUnique({ where: { id: d.clientId }, select: { id: true, rfc: true, companyName: true } });
  if (!client) return { error: "El cliente no existe" };
  if (d.kind === "FACTURA" && !client.rfc) {
    return { error: `«${client.companyName}» no tiene RFC capturado. Captúralo en Clientes y proyectos › Datos fiscales y de contacto y vuelve a registrar la factura.` };
  }

  const vat = d.kind === "FACTURA" ? vatOf(subtotal) : 0;
  const invoice = await prisma.invoice.create({
    data: {
      kind: d.kind,
      number: d.number || null,
      clientId: client.id,
      rfc: d.kind === "FACTURA" ? client.rfc : null,
      description: d.description.toUpperCase(),
      subtotal: centsToDecimal(subtotal),
      vat: centsToDecimal(vat),
      total: centsToDecimal(subtotal + vat),
      isSoftware: fd.get("isSoftware") === "on",
      dueDate: dateOnly(d.dueDate),
      createdById: user.id,
    },
  });
  await log(invoice.id, user.id, "CREATED", { kind: d.kind, total: subtotal + vat });
  revalidatePath("/facturas");
  return { ok: true };
}

/** Corrige una factura mientras siga Enviada. Queda registrado qué cambió. */
export async function updateInvoice(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const parsed = z.object({ id: z.string().uuid(), ...common }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const subtotal = parseMoney(d.subtotal);
  if (subtotal === null) return { error: "El subtotal debe ser un monto mayor a cero (por ejemplo 12500.50)" };

  const inv = await prisma.invoice.findUnique({ where: { id: d.id } });
  if (!inv) return { error: "No se encontró el documento" };
  if (inv.status !== "ENVIADA") return { error: "Solo se puede corregir mientras esté Enviada. Si ya se pagó, pide al Administrador que revierta el pago." };

  const vat = inv.kind === "FACTURA" ? vatOf(subtotal) : 0;
  const next = {
    description: d.description.toUpperCase(),
    number: d.number || null,
    subtotal: centsToDecimal(subtotal),
    vat: centsToDecimal(vat),
    total: centsToDecimal(subtotal + vat),
    isSoftware: fd.get("isSoftware") === "on",
    dueDate: dateOnly(d.dueDate),
  };
  const before = {
    description: inv.description,
    number: inv.number,
    subtotal: centsToDecimal(decimalToCents(inv.subtotal)),
    isSoftware: inv.isSoftware,
    dueDate: inv.dueDate.toISOString().slice(0, 10),
  };
  await prisma.invoice.update({ where: { id: inv.id }, data: next });
  await log(inv.id, user.id, "EDITED", {
    before,
    after: { ...before, description: next.description, number: next.number, subtotal: next.subtotal, isSoftware: next.isSoftware, dueDate: d.dueDate },
  });
  revalidatePath("/facturas");
  revalidatePath(`/facturas/${inv.id}`);
  return { ok: true };
}

/** Marca como pagada: se elige la cuenta que recibió el dinero y la fecha real del cobro. */
export async function markInvoicePaid(id: string, account: string, collectedOn: string): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return { error: "No se encontró el documento" };
  if (inv.status !== "ENVIADA") return { error: "Este documento ya está pagado" };

  const allowed = accountsFor(inv.kind as InvoiceKind).find((a) => a.value === account);
  if (!allowed) return { error: "Esa cuenta no puede recibir este tipo de documento" };
  if (!isValidIsoDate(collectedOn)) return { error: "Indica la fecha en que entró el dinero" };
  if (collectedOn > todayMx()) return { error: "La fecha de cobro no puede ser futura" };

  // Reparto del cobro en las cajas (Etapa 2): se guarda "congelado" con los porcentajes de este momento
  const cfg = await getSplitConfig();
  let lines;
  try {
    lines = computeDistribution({ subtotal: decimalToCents(inv.subtotal), vat: decimalToCents(inv.vat), isSoftware: inv.isSoftware }, cfg);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo calcular el reparto" };
  }
  const collected = dateOnly(collectedOn);

  try {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.invoice.updateMany({
        where: { id, status: "ENVIADA" },
        data: { status: "PAGADA", paidAt: new Date(), collectedOn: collected, account: allowed.value as PaymentAccount, paidById: user.id },
      });
      if (upd.count === 0) throw new Error("Este documento ya está pagado");
      await writeEntries(
        tx,
        lines.map((l) => ({ box: l.box, cashType: allowed.type, cents: l.cents, kind: "DISTRIBUCION" as const, occurredOn: collected, createdById: user.id, invoiceId: id })),
      );
      const snapshot: DistributionSnapshot = { cfg, cashType: allowed.type, total: decimalToCents(inv.total), lines };
      await tx.invoice.update({ where: { id }, data: { distribution: JSON.stringify(snapshot) } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el cobro" };
  }
  await log(id, user.id, "PAID", { account: allowed.value, collectedOn });
  revalidatePath("/facturas");
  revalidatePath(`/facturas/${id}`);
  revalidatePath("/finanzas");
  return {};
}

/** Solo el Administrador puede deshacer un pago, y debe explicar por qué. */
export async function revertInvoicePaid(id: string, reason: string): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN"]);
  if (reason.trim().length < 3) return { error: "Escribe el motivo" };
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.status !== "PAGADA") return { error: "El documento no está pagado" };

  try {
    await prisma.$transaction(async (tx) => {
      // Lo que este documento tiene vigente en las cajas (reparto menos reversas anteriores) se devuelve
      const outstanding = await tx.ledgerEntry.groupBy({ by: ["box", "cashType"], where: { invoiceId: id }, _sum: { amount: true } });
      const back = outstanding
        .map((o) => ({ box: o.box, cashType: o.cashType, cents: -decimalToCents(o._sum.amount ?? 0) }))
        .filter((o) => o.cents !== 0);
      const blocked = firstNegative(await getBalances(tx), back);
      if (blocked) throw new Error(`No se puede revertir: la caja ${blocked} ya no tiene saldo suficiente para devolver ese reparto (se gastó o se movió). Ajusta primero ese movimiento.`);
      await writeEntries(tx, back.map((b) => ({ ...b, kind: "REVERSA" as const, occurredOn: dateOnly(todayMx()), createdById: user.id, invoiceId: id, note: "Pago revertido" })));
      await tx.invoice.update({
        where: { id },
        data: { status: "ENVIADA", paidAt: null, collectedOn: null, account: null, paidById: null, distribution: null },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo revertir" };
  }
  await log(id, user.id, "REVERTED", { reason: reason.trim(), was: { account: inv.account, collectedOn: inv.collectedOn?.toISOString().slice(0, 10) } });
  revalidatePath("/facturas");
  revalidatePath(`/facturas/${id}`);
  revalidatePath("/finanzas");
  return {};
}

/** Datos bancarios para recibir pagos (solo Administrador). */
export async function saveBankData(raw: string): Promise<{ error?: string; ok?: boolean }> {
  await requireUser(["ADMIN"]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "No se pudieron leer los datos" };
  }
  const accounts = cleanBankAccounts(parsed);
  await saveBankAccounts(accounts);
  revalidatePath("/facturas/datos-bancarios");
  return { ok: true };
}
