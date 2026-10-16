import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { accountLabel, displayStatus, isoDate, KIND_LABEL, STATUS_LABEL, todayMx } from "@/lib/finance";
import { filtersToWhere, parseFilters, statusWhere } from "@/lib/invoices";

export const runtime = "nodejs";

/** Evita que Excel interprete como fórmula un texto que empieza con = + - @. */
const cell = (v: string | number | null | undefined) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const stamp = (d: Date | null) => (d ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "short" }).format(d) : "");

/** Exporta a CSV (se abre en Excel) las facturas y recibos con los mismos filtros de la pantalla. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return Response.json({ error: "No autorizado" }, { status: 403 });

  const f = parseFilters(Object.fromEntries(new URL(req.url).searchParams));
  const today = todayMx();
  const where: Prisma.InvoiceWhereInput = { AND: [filtersToWhere(f), statusWhere(f.estado, today)] };
  const rows = await prisma.invoice.findMany({
    where,
    include: { client: { select: { companyName: true } }, createdBy: { select: { name: true } } },
    orderBy: { sentAt: "desc" },
    take: 5000,
  });

  const head = ["Tipo", "Número", "Cliente", "RFC", "Descripción", "Software", "Subtotal", "IVA", "Total", "Fecha límite", "Estatus", "Fecha de envío", "Fecha de cobro", "Cuenta receptora", "Registró"];
  const lines = [head.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        KIND_LABEL[r.kind], r.number, r.client.companyName, r.rfc, r.description, r.isSoftware ? "Sí" : "No",
        r.subtotal.toFixed(2), r.vat.toFixed(2), r.total.toFixed(2), isoDate(r.dueDate), STATUS_LABEL[displayStatus(r, today)],
        stamp(r.sentAt), r.collectedOn ? isoDate(r.collectedOn) : "", r.account ? accountLabel(r.account) : "", r.createdBy.name,
      ].map(cell).join(","),
    );
  }

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Facturas-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
