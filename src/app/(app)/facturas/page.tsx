import Link from "next/link";
import { Download, Landmark, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dateOnly, displayStatus, fmtDate, fmtDateTime, formatDecimal, KIND_LABEL, accountLabel, todayMx } from "@/lib/finance";
import { filtersToWhere, invoiceScope, parseFilters, statusWhere } from "@/lib/invoices";
import { InvoiceForm } from "./invoice-form";
import { PayButton } from "./pay-button";
import { StatusPill } from "./status-pill";

const MAX_ROWS = 500;

const Kpi = ({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "red" | "green" | "blue" }) => (
  <div className="card space-y-1">
    <p className="meta">{label}</p>
    <p className={`text-2xl font-semibold tracking-tight ${tone === "red" ? "text-[#D70015] dark:text-[#FF453A]" : tone === "green" ? "text-[#248A3D] dark:text-[#30D158]" : ""}`}>{value}</p>
    <p className="text-xs text-zinc-500">{hint}</p>
  </div>
);

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["ADMIN", "EDITOR", "CLIENTE"]); // el TEAM 311 no ve facturas
  const isClient = user.role === "CLIENTE";
  const sp = await searchParams;
  const f = parseFilters(sp);
  const today = todayMx();
  const t = dateOnly(today);

  const base: Prisma.InvoiceWhereInput = { AND: [invoiceScope(user), filtersToWhere(f)] };
  const where: Prisma.InvoiceWhereInput = { AND: [base, statusWhere(f.estado, today)] };

  const [rows, total, clients, facturado, cobrado, pendiente, vencido] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { client: { select: { companyName: true } } },
      orderBy: [{ sentAt: "desc" }],
      take: MAX_ROWS,
    }),
    prisma.invoice.count({ where }),
    isClient ? Promise.resolve([]) : prisma.client.findMany({ select: { id: true, companyName: true, rfc: true }, orderBy: { companyName: "asc" } }),
    isClient ? null : prisma.invoice.aggregate({ where: base, _sum: { total: true } }),
    isClient ? null : prisma.invoice.aggregate({ where: { AND: [base, { status: "PAGADA" }] }, _sum: { total: true } }),
    isClient ? null : prisma.invoice.aggregate({ where: { AND: [base, { status: "ENVIADA", dueDate: { gte: t } }] }, _sum: { total: true } }),
    isClient ? null : prisma.invoice.aggregate({ where: { AND: [base, { status: "ENVIADA", dueDate: { lt: t } }] }, _sum: { total: true } }),
  ]);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v && !(k === "fecha" && !f.mes)) qs.set(k, v);
  const exportHref = `/api/facturas/export${qs.toString() ? `?${qs}` : ""}`;
  const filtered = !!(f.estado || f.tipo || f.cliente || f.mes || f.q);
  const sum = (a: typeof facturado) => formatDecimal(a?._sum.total ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">Facturas y recibos</h1>
        {!isClient && (
          <Link href="/facturas/datos-bancarios" className="btn-outline"><Landmark size={16} /> Datos bancarios</Link>
        )}
      </div>

      {!isClient && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Facturado" value={sum(facturado)} hint="Todo lo registrado" />
          <Kpi label="Cobrado" value={sum(cobrado)} hint="Documentos pagados" tone="green" />
          <Kpi label="Pendiente por cobrar" value={sum(pendiente)} hint="Enviadas dentro de su plazo" tone="blue" />
          <Kpi label="Vencido" value={sum(vencido)} hint="Enviadas con fecha límite pasada" tone="red" />
        </div>
      )}

      {!isClient && (
        <details className="card group space-y-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="btn"><Plus size={16} /> Registrar factura o recibo</span>
            <span className="meta hidden group-open:inline">Clic de nuevo para plegar</span>
          </summary>
          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-semibold tracking-tight">Registrar factura o recibo enviado</h2>
            <InvoiceForm clients={clients} />
          </div>
        </details>
      )}

      <form method="get" className="card grid items-end gap-3 md:grid-cols-7">
        <div className="md:col-span-2">
          <label className="label" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={f.q} className="input" placeholder="Descripción, número o cliente" />
        </div>
        <div>
          <label className="label" htmlFor="estado">Estatus</label>
          <select id="estado" name="estado" defaultValue={f.estado} className="input">
            <option value="">Todos</option>
            <option value="ENVIADA">Enviada</option>
            <option value="VENCIDA">Vencida</option>
            <option value="PAGADA">Pagada</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={f.tipo} className="input">
            <option value="">Todos</option>
            <option value="FACTURA">Facturas</option>
            <option value="RECIBO">Recibos simples</option>
          </select>
        </div>
        {!isClient && (
          <div>
            <label className="label" htmlFor="cliente">Cliente</label>
            <select id="cliente" name="cliente" defaultValue={f.cliente} className="input">
              <option value="">Todos</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="fecha">Filtrar por fecha de…</label>
          <select id="fecha" name="fecha" defaultValue={f.fecha} className="input">
            <option value="creacion">Creación</option>
            <option value="envio">Envío</option>
            <option value="cobro">Cobro</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mes">Mes</label>
          <input id="mes" name="mes" type="month" defaultValue={f.mes} className="input" />
        </div>
        <div className="flex gap-2 md:col-span-7">
          <button className="btn" type="submit">Filtrar</button>
          {filtered && <Link href="/facturas" className="btn-outline">Limpiar</Link>}
          {!isClient && <a href={exportHref} className="btn-outline ml-auto"><Download size={16} /> Exportar a Excel</a>}
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr>
              {!isClient && <th className="th">Envío</th>}
              <th className="th">Documento</th>
              {!isClient && <th className="th">Cliente</th>}
              <th className="th">Descripción</th>
              <th className="th text-right">Total</th>
              <th className="th">Fecha límite</th>
              <th className="th">Estatus</th>
              {!isClient && <th className="th">Cobro</th>}
              {!isClient && <th className="th" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {rows.map((r) => {
              const st = displayStatus(r, today);
              return (
                <tr key={r.id} className="transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
                  {!isClient && <td className="td whitespace-nowrap text-sm">{fmtDateTime(r.sentAt)}</td>}
                  <td className="td text-sm">
                    <span className="font-medium">{KIND_LABEL[r.kind]}</span>
                    {r.number && <span className="block text-xs text-zinc-500">{r.number}</span>}
                    {r.isSoftware && !isClient && <span className="block text-xs text-[#007AFF]">Software</span>}
                  </td>
                  {!isClient && <td className="td text-sm">{r.client.companyName}</td>}
                  <td className="td max-w-xs text-sm">{r.description}</td>
                  <td className="td whitespace-nowrap text-right text-sm font-medium">{formatDecimal(r.total)}</td>
                  <td className="td whitespace-nowrap text-sm">{fmtDate(r.dueDate)}</td>
                  <td className="td">
                    {!isClient && st !== "PAGADA" ? (
                      <PayButton id={r.id} kind={r.kind} status={st} today={today} label={`${KIND_LABEL[r.kind]} de ${r.client.companyName}`} />
                    ) : (
                      <StatusPill status={st} />
                    )}
                  </td>
                  {!isClient && (
                    <td className="td whitespace-nowrap text-xs text-zinc-500">
                      {r.collectedOn ? <>{fmtDate(r.collectedOn)}<span className="block">{accountLabel(r.account)}</span></> : "—"}
                    </td>
                  )}
                  {!isClient && <td className="td"><Link href={`/facturas/${r.id}`} className="link text-sm">Ver</Link></td>}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={isClient ? 5 : 9} className="td py-8 text-center text-zinc-500">{filtered ? "No hay resultados con estos filtros" : "Aún no hay facturas ni recibos registrados"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {total > MAX_ROWS && <p className="meta">Se muestran los {MAX_ROWS} más recientes de {total}. Usa los filtros para acotar.</p>}
    </div>
  );
}
