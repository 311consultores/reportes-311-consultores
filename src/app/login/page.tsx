import { getLogo311Key } from "@/lib/branding";
import { LoginForm } from "./login-form";
import { safeNext } from "@/app/actions/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const hasLogo = !!(await getLogo311Key().catch(() => null));

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-8 p-8">
        <div className="space-y-3 text-center">
          {hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/branding/logo" alt="311 Consultores" className="mx-auto max-h-16 max-w-[220px] object-contain" />
          )}
          <h1 className="text-2xl font-semibold tracking-tight">311 CONSULTORES</h1>
          <p className="meta">Sistema de reportes de actividades</p>
        </div>
        <LoginForm next={await safeNext(next)} />
      </div>
    </main>
  );
}
