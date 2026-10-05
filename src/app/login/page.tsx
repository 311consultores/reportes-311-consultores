import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-8 p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">311 CONSULTORES</h1>
          <p className="meta">Sistema de reportes de actividades</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
