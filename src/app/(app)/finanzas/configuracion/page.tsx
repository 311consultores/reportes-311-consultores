import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSplitConfig } from "@/lib/ledger";
import { FinanzasTabs } from "../tabs";
import { DistributeButton } from "./distribute-button";
import { SplitForm } from "./split-form";

export default async function SplitConfigPage() {
  await requireUser(["ADMIN"]);
  const [config, pastCount] = await Promise.all([
    getSplitConfig(),
    prisma.invoice.count({ where: { status: "PAGADA", distribution: null, account: { not: null } } }),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="page-title">Finanzas</h1>
      <FinanzasTabs active="/finanzas/configuracion" />

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Porcentajes del reparto</h2>
          <p className="meta">
            Cuando una factura o recibo se marca como pagado, su ingreso neto (el subtotal, sin IVA) se reparte con estos porcentajes.
            En los proyectos de desarrollo primero se descuenta el pago de DEV y lo que queda es el nuevo 100 % al que se le aplican Nómina,
            Ahorro, Navidad y Gastos. Lo que sobra es la utilidad, de la que cada socio recibe su parte. El IVA se divide aparte. Cada cobro
            guarda los porcentajes que tenía al momento: cambiarlos aquí no altera los cobros anteriores.
          </p>
        </div>
        <SplitForm config={config} />
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Cobros anteriores sin repartir</h2>
        {pastCount > 0 ? (
          <>
            <p className="meta">
              Hay {pastCount} factura(s) o recibo(s) que se marcaron como pagados antes de existir las cajas. Reparte su dinero para que
              las cajas reflejen todo lo cobrado.
            </p>
            <DistributeButton count={pastCount} />
          </>
        ) : (
          <p className="meta">Todos los cobros pagados ya están repartidos en las cajas.</p>
        )}
      </section>
    </div>
  );
}
