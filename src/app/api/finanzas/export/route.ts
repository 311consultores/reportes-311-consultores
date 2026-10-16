import { getCurrentUser } from "@/lib/auth";
import { isoDate } from "@/lib/finance";
import { getFlow, parseMonthParam } from "@/lib/finance-queries";

export const runtime = "nodejs";

/** Evita que Excel interprete como fórmula un texto que empieza con = + - @. */
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Ingresos y egresos del mes (o de todo el historial) en CSV, para abrir en Excel. Solo Administrador. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 403 });

  const mes = parseMonthParam(new URL(req.url).searchParams.get("mes") ?? undefined);
  const { rows } = await getFlow(mes);
  const money = (c: number) => (c / 100).toFixed(2);

  const lines = [["Fecha", "Tipo", "Concepto", "Detalle", "Ingreso", "Egreso", "Estado"].map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        isoDate(r.date), r.type, r.concept, r.detail,
        r.type === "Ingreso" ? money(r.cents) : "",
        r.type === "Egreso" ? money(r.cents) : "",
        r.voided ? "Anulado" : "",
      ].map(cell).join(","),
    );
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Ingresos-y-egresos-${mes || "historial"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
