// Parte de servidor de las cajas: lee y escribe en la base de datos. La lógica pura está en ledger-shared.ts.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/branding";
import { centsToDecimal, decimalToCents } from "@/lib/finance";
import { DEFAULT_SPLIT, key, validateSplit, type Balances, type SplitConfig } from "@/lib/ledger-shared";

export * from "@/lib/ledger-shared";

type Db = Prisma.TransactionClient | typeof prisma;

const SPLIT_KEY = "reparto_porcentajes";

export async function getSplitConfig(): Promise<SplitConfig> {
  try {
    const raw = JSON.parse((await getSetting(SPLIT_KEY)) ?? "{}") as Partial<SplitConfig>;
    const merged = { ...DEFAULT_SPLIT, ...raw };
    return validateSplit(merged) ? DEFAULT_SPLIT : merged;
  } catch {
    return DEFAULT_SPLIT;
  }
}

export const saveSplitConfig = (c: SplitConfig) => setSetting(SPLIT_KEY, JSON.stringify(c));

export async function getBalances(db: Db = prisma): Promise<Balances> {
  const rows = await db.ledgerEntry.groupBy({ by: ["box", "cashType"], _sum: { amount: true } });
  return new Map(rows.map((r) => [key(r.box, r.cashType), decimalToCents(r._sum.amount ?? 0)]));
}

export type NewEntry = {
  box: Prisma.LedgerEntryUncheckedCreateInput["box"];
  cashType: Prisma.LedgerEntryUncheckedCreateInput["cashType"];
  cents: number;
  kind: Prisma.LedgerEntryUncheckedCreateInput["kind"];
  occurredOn: Date;
  createdById: string;
  invoiceId?: string;
  expenseId?: string;
  movementId?: string;
  note?: string;
};

export async function writeEntries(db: Db, entries: NewEntry[]) {
  if (entries.length === 0) return;
  await db.ledgerEntry.createMany({
    data: entries.map((e) => ({
      box: e.box,
      cashType: e.cashType,
      amount: centsToDecimal(e.cents),
      kind: e.kind,
      occurredOn: e.occurredOn,
      createdById: e.createdById,
      invoiceId: e.invoiceId ?? null,
      expenseId: e.expenseId ?? null,
      movementId: e.movementId ?? null,
      note: e.note?.slice(0, 191) ?? null,
    })),
  });
}
