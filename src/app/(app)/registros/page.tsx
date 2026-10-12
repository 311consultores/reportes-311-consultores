import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { registroActivo } from "@/lib/registro";
import { LinkCard } from "./link-card";

const when = (d: Date) => d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });

export default async function RegistrosPage() {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const [url, active, pending, history] = await Promise.all([
    getBaseUrl().then((b) => `${b}/registro`),
    registroActivo(),
    prisma.clientRegistration.findMany({ where: { status: "PENDIENTE" }, orderBy: { createdAt: "asc" } }),
    prisma.clientRegistration.findMany({
      where: { status: { not: "PENDIENTE" } },
      include: { reviewedBy: { select: { name: true } } },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="page-title">Registro de clientes</h1>

      <LinkCard url={url} active={active} isAdmin={user.role === "ADMIN"} />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Registros por revisar</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10">
              <tr>
                <th className="th">Fecha</th><th className="th">Empresa</th><th className="th">Contacto</th>
                <th className="th">Factura</th><th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {pending.map((r) => (
                <tr key={r.id} className="transition-colors duration-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
                  <td className="td whitespace-nowrap">{when(r.createdAt)}</td>
                  <td className="td font-medium">{r.companyName}</td>
                  <td className="td">{r.contactName}<br /><span className="meta">{r.contactEmail}</span></td>
                  <td className="td">{r.requiresInvoice ? "Sí" : "No"}</td>
                  <td className="td text-right"><Link href={`/registros/${r.id}`} className="btn">Revisar</Link></td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr><td colSpan={5} className="td py-8 text-center text-zinc-500">No hay registros pendientes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Historial</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-black/5 dark:border-white/10">
              <tr><th className="th">Fecha</th><th className="th">Empresa</th><th className="th">Resultado</th><th className="th">Atendió</th><th className="th">Motivo</th></tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap">{r.reviewedAt ? when(r.reviewedAt) : "—"}</td>
                  <td className="td font-medium">{r.companyName}</td>
                  <td className="td">
                    <span
                      className={
                        r.status === "APROBADO"
                          ? "rounded-full bg-[#34C759]/15 px-3 py-1 text-xs font-medium text-[#248A3D] dark:text-[#30D158]"
                          : "rounded-full bg-[#FF3B30]/10 px-3 py-1 text-xs font-medium text-[#D70015] dark:text-[#FF453A]"
                      }
                    >
                      {r.status === "APROBADO" ? "Aprobado" : "Rechazado"}
                    </span>
                  </td>
                  <td className="td">{r.reviewedBy?.name ?? "—"}</td>
                  <td className="td">{r.rejectionReason ?? "—"}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={5} className="td py-8 text-center text-zinc-500">Aún no hay registros atendidos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
