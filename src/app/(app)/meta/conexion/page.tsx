import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { aiReady } from "@/lib/ai";
import { isDemo, META_VERSION, testConnection } from "@/lib/meta";
import { AccountsAdmin } from "./accounts-admin";

export const metadata = { title: "Conexión con Meta | Portal de Operaciones" };

const Check = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <li className="flex items-start gap-2 text-sm"><span aria-hidden>{ok ? "✅" : "⬜"}</span><span>{children}</span></li>
);

export default async function MetaConnectionPage() {
  await requireUser(["ADMIN"]);
  const [conn, accounts, clients, people] = await Promise.all([
    testConnection(),
    prisma.metaAccount.findMany({ orderBy: { name: "asc" }, include: { access: { select: { userId: true } } } }),
    prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["EDITOR", "PROJECT_311"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">Conexión con Meta</h1>
        <p className="meta">Aquí se revisa la conexión, se importan las cuentas publicitarias y se decide qué personas ven a qué cliente. <Link href="/meta" className="link">Volver a Campañas Meta</Link></p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Estado de la conexión</h2>
        <ul className="space-y-1.5">
          <Check ok={conn.ok}>{conn.message}{conn.accounts !== undefined ? ` Cuentas publicitarias visibles: ${conn.accounts}.` : ""}</Check>
          <Check ok={aiReady()}>{aiReady() ? "Guía de IA (Claude) configurada." : "Guía de IA sin configurar: falta ANTHROPIC_API_KEY en el servidor."}</Check>
        </ul>
        <p className="meta text-xs">Versión de la API de Meta: {META_VERSION}{isDemo() ? " · modo demostración" : ""}. El token y las claves se guardan solo en las variables del servidor; nunca se muestran aquí.</p>
      </section>

      <AccountsAdmin
        accounts={accounts.map((a) => ({ id: a.id, adAccountId: a.adAccountId, name: a.name, currency: a.currency, clientId: a.clientId, active: a.active, userIds: a.access.map((x) => x.userId), lastSyncAt: a.lastSyncAt?.toISOString() ?? null }))}
        clients={clients.map((c) => ({ id: c.id, name: c.companyName }))}
        people={people.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
        connected={conn.ok}
      />
    </div>
  );
}
