import Link from "next/link";
import { getLogo311Key } from "@/lib/branding";
import { validateResetToken } from "@/app/actions/auth";
import { ResetForm } from "./reset-form";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = !!(await validateResetToken(token));
  const hasLogo = !!(await getLogo311Key().catch(() => null));

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-6 p-8">
        <div className="space-y-3 text-center">
          {hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/branding/logo" alt="311 Consultores" className="mx-auto max-h-16 max-w-[220px] object-contain" />
          )}
          <h1 className="text-xl font-semibold tracking-tight">Nueva contraseña</h1>
        </div>
        {valid ? (
          <ResetForm token={token} />
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-destructive">El enlace no es válido o ya venció.</p>
            <Link href="/recuperar" className="btn">Solicitar un enlace nuevo</Link>
          </div>
        )}
        <p className="text-center text-sm">
          <Link href="/login" className="link">Volver a iniciar sesión</Link>
        </p>
      </div>
    </main>
  );
}
