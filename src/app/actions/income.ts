"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Box, CashType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { centsToDecimal, dateOnly, decimalToCents, isValidIsoDate, parseMoney, todayMx } from "@/lib/finance";
import { acceptsDirectIncome, firstNegative, getBalances, isBox, isCash, writeEntries } from "@/lib/ledger";

type State = { error?: string; ok?: boolean } | undefined;

const refresh = (box?: string) => {
  revalidatePath("/finanzas");
  if (box) revalidatePath(`/finanzas/caja/${box}`);
};

/**
 * Registra un ingreso directo en una caja (solo el ADMINISTRADOR): suma tal cual a la caja elegida, sin el reparto de un cobro.
 * Queda con concepto, motivo, monto, fecha y procedencia (cliente y proyecto opcionales, u «Otro» indicando de dónde viene).
 */
export async function createDirectIncome(_p: State, fd: FormData): Promise<State> {
  const user = await requireUser(["ADMIN"]);
  const parsed = z
    .object({
      box: z.string(),
      cashType: z.string(),
      amount: z.string(),
      concept: z.string().trim().min(3, "Escribe el concepto").max(200, "El concepto es demasiado largo"),
      reason: z.string().trim().min(3, "Escribe el motivo del ingreso").max(300, "El motivo es demasiado largo"),
      occurredOn: z.string().refine(isValidIsoDate, "Indica la fecha").refine((d) => d <= todayMx(), "La fecha no puede ser futura"),
      origin: z.enum(["CLIENTE", "OTRO"]),
      originNote: z.string().trim().max(200, "La procedencia es demasiado larga").optional(),
      clientId: z.string().optional(),
      projectId: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!isBox(d.box) || !acceptsDirectIncome(d.box)) return { error: "Esa caja no admite ingresos directos" };
  if (!isCash(d.cashType)) return { error: "Elige si el ingreso entra en efectivo o en banco" };
  const box: Box = d.box;
  const cashType: CashType = d.cashType;
  const cents = parseMoney(d.amount);
  if (cents === null) return { error: "El monto debe ser mayor a cero (por ejemplo 1500.00)" };

  let originNote: string | null = null;
  let clientId: string | null = null;
  let projectId: string | null = null;
  if (d.origin === "OTRO") {
    if (!d.originNote || d.originNote.length < 2) return { error: "Indica la procedencia del ingreso (por ejemplo: rendimientos del banco, aportación de un socio)" };
    originNote = d.originNote;
  } else {
    // Cliente y proyecto son opcionales; si se elige proyecto debe ser del cliente
    if (d.clientId && /^[0-9a-f-]{36}$/i.test(d.clientId)) {
      if (!(await prisma.client.findUnique({ where: { id: d.clientId }, select: { id: true } }))) return { error: "El cliente no existe" };
      clientId = d.clientId;
      if (d.projectId && /^[0-9a-f-]{36}$/i.test(d.projectId)) {
        if (!(await prisma.project.findFirst({ where: { id: d.projectId, clientId }, select: { id: true } }))) return { error: "El proyecto no pertenece al cliente" };
        projectId = d.projectId;
      }
    }
  }

  const on = dateOnly(d.occurredOn);
  try {
    await prisma.$transaction(async (tx) => {
      const inc = await tx.directIncome.create({
        data: { box, cashType, amount: centsToDecimal(cents), concept: d.concept, reason: d.reason, origin: d.origin, originNote, clientId, projectId, occurredOn: on, createdById: user.id },
      });
      await writeEntries(tx, [{ box, cashType, cents, kind: "INGRESO_DIRECTO", occurredOn: on, createdById: user.id, incomeId: inc.id, note: d.concept }]);
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el ingreso" };
  }
  refresh(box);
  return { ok: true };
}

/** Anula un ingreso directo (con motivo): el dinero sale otra vez de la caja y el registro se conserva marcado como anulado. */
export async function voidDirectIncome(id: string, reason: string): Promise<{ error?: string }> {
  const user = await requireUser(["ADMIN"]);
  if (reason.trim().length < 3) return { error: "Escribe el motivo" };
  let box: Box | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      const inc = await tx.directIncome.findUnique({ where: { id } });
      if (!inc || inc.voidedAt) throw new Error("El ingreso no existe o ya fue anulado");
      box = inc.box;
      const cents = decimalToCents(inc.amount);
      const blocked = firstNegative(await getBalances(tx), [{ box: inc.box, cashType: inc.cashType, cents: -cents }]);
      if (blocked) throw new Error(`No se puede anular: la caja ${blocked} ya no tiene saldo suficiente para deshacerlo.`);
      await writeEntries(tx, [{ box: inc.box, cashType: inc.cashType, cents: -cents, kind: "ANULA_INGRESO", occurredOn: dateOnly(todayMx()), createdById: user.id, incomeId: id, note: `Anulado: ${inc.concept}` }]);
      await tx.directIncome.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason.trim().slice(0, 300), voidedById: user.id } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo anular" };
  }
  refresh(box);
  return {};
}
