"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import { PasswordInput } from "@/components/password-input";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-xl bg-[#34C759]/15 p-4 text-sm text-[#248A3D] dark:text-[#30D158]">
          Tu contraseña se actualizó correctamente.
        </p>
        <Link href="/login" className="btn">Iniciar sesión</Link>
      </div>
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
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">Nueva contraseña</label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirmar contraseña</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
