import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { bankAccountText, getBankAccounts } from "@/lib/invoices";
import { CopyButton } from "@/components/copy-button";
import { BankEditor } from "./bank-editor";

export default async function BankDataPage() {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const isAdmin = user.role === "ADMIN";
  const accounts = await getBankAccounts();

  const rows = (a: (typeof accounts)[number]) =>
    [
      ["Titular", a.holder],
      ["RFC", a.rfc],
      ["Banco", a.bank],
      ["CLABE", a.clabe],
      ["Cuenta", a.account],
      ["Tarjeta", a.card],
    ].filter(([, v]) => v);

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/facturas" className="btn-outline inline-flex"><ArrowLeft size={16} /> Facturas</Link>
      <div>
        <h1 className="page-title">Datos bancarios</h1>
        <p className="meta">Cuentas para recibir pagos. Usa «Copiar todo» para pegarlo en un correo o mensaje al cliente.</p>
      </div>

      {accounts.length === 0 && (
        <p className="card meta">
          {isAdmin ? "Aún no hay cuentas capturadas. Agrégalas abajo." : "Aún no hay cuentas capturadas. Pide al Administrador que las agregue."}
        </p>
      )}

      {accounts.map((a, i) => (
        <section key={i} className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{a.title}</h2>
            <CopyButton text={bankAccountText(a)} label="Copiar todo" className="!bg-[#007AFF]/10" />
          </div>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            {rows(a).map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="flex flex-wrap items-center gap-1 font-mono text-[13px]">
                  {value}
                  <CopyButton text={value} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {isAdmin && (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Editar datos bancarios</h2>
          <p className="meta">Solo el Administrador puede modificarlos. Estos datos se guardan en el sistema y no forman parte del código.</p>
          <BankEditor initial={accounts} />
        </section>
      )}
    </div>
  );
}
