"use client";

import { startTransition, useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";

export function RecoverForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.ok) {
    return (
      <p className="rounded-xl bg-[#34C759]/15 p-4 text-sm text-[#248A3D] dark:text-[#30D158]">
        Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos. El enlace vence en 1 hora.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
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
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}
