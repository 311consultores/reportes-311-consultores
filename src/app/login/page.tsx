import { getLogo311Key } from "@/lib/branding";
import { PortalBrand } from "@/components/portal-brand";
import { LoginForm } from "./login-form";
import { safeNext } from "@/app/actions/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const hasLogo = !!(await getLogo311Key().catch(() => null));

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-8 p-8">
        <div className="space-y-3 text-center">
          <PortalBrand hasLogo={hasLogo} />
        </div>
        <LoginForm next={await safeNext(next)} />
      </div>
    </main>
  );
}
