import Link from "next/link";
import { getLogo311Key } from "@/lib/branding";
import { RecoverForm } from "./recover-form";

export default async function RecoverPage() {
  const hasLogo = !!(await getLogo311Key().catch(() => null));
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-6 p-8">
        <div className="space-y-3 text-center">
          {hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/branding/logo" alt="311 Consultores" className="mx-auto max-h-16 max-w-[220px] object-contain" />
          )}
          <h1 className="text-xl font-semibold tracking-tight">Recuperar contraseña</h1>
          <p className="meta">Escribe tu correo y te enviaremos un enlace para elegir una nueva contraseña.</p>
        </div>
        <RecoverForm />
        <p className="text-center text-sm">
          <Link href="/login" className="link">Volver a iniciar sesión</Link>
        </p>
      </div>
    </main>
  );
}
