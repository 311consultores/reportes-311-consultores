import Link from "next/link";
import { getLogo311Key } from "@/lib/branding";
import { PortalBrand } from "@/components/portal-brand";
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
          <PortalBrand hasLogo={hasLogo} />
          <h1 className="pt-2 text-xl font-semibold tracking-tight">Nueva contraseña</h1>
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
