"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { login } from "@/app/actions/auth";
import { PasswordInput } from "@/components/password-input";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form
      className="space-y-4"
      // Envío manual: React 19 vacía los campos tras cada <form action>, y el correo debe conservarse
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" required autoFocus autoComplete="username" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <PasswordInput id="password" name="password" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Entrando…" : "Iniciar sesión"}
      </button>
      <p className="text-center text-sm">
        <Link href="/recuperar" className="link">¿Olvidaste tu contraseña?</Link>
      </p>
    </form>
  );
}
