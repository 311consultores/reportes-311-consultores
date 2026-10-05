"use client";

import { startTransition, useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
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
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" required autoFocus className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" required className="input" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
