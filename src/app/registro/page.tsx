import { getLogo311Key } from "@/lib/branding";
import { registroActivo } from "@/lib/registro";
import { RegistroForm } from "./registro-form";

export const metadata = { title: "Registro de clientes | 311 CONSULTORES" };

export default async function RegistroPage() {
  const [activo, hasLogo] = await Promise.all([registroActivo(), getLogo311Key().then((k) => !!k).catch(() => false)]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-start justify-center p-4 py-10">
      <div className="card w-full space-y-8 p-6 sm:p-10">
        <div className="space-y-3 text-center">
          {hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/branding/logo" alt="311 Consultores" className="mx-auto max-h-16 max-w-[220px] object-contain" />
          )}
          <h1 className="text-2xl font-semibold tracking-tight">Registro de clientes</h1>
          <p className="meta">Completa tus datos para darte de alta con 311 Consultores. Solo toma unos minutos.</p>
        </div>

        {activo ? (
          <RegistroForm />
        ) : (
          <p className="rounded-xl bg-black/5 p-4 text-center text-sm dark:bg-white/10">
            El registro no está disponible por ahora. Escríbenos a{" "}
            <a className="link" href="mailto:admon@311consultores.com">admon@311consultores.com</a>.
          </p>
        )}
      </div>
    </main>
  );
}
