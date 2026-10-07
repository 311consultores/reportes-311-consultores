"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Algo salió mal</h1>
        <p className="meta">Ocurrió un error en el servidor. Si se repite, revisa /api/health o avisa al administrador.</p>
        {error.digest && <p className="meta">Referencia: {error.digest}</p>}
        <button className="btn" onClick={reset}>Reintentar</button>
      </div>
    </main>
  );
}
