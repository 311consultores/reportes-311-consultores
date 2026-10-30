"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkAccount, unlinkAccount } from "@/app/actions/account-link";
import { ActionForm } from "@/components/action-form";

/** Cuenta vinculada del Administrador: con un botón del menú cambia de una cuenta a la otra sin volver a iniciar sesión. */
export function LinkAccount({ linked }: { linked: { name: string; roleLabel: string } | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();

  if (linked) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Cuenta vinculada: <strong>{linked.name}</strong> · {linked.roleLabel}</p>
        <p className="meta text-xs">Usa el botón «Cambiar a…» del menú lateral para pasar de una cuenta a la otra sin escribir contraseñas.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="button"
          className="btn-outline"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`¿Desvincular la cuenta de ${linked.name}? Ya no podrás cambiar entre las dos cuentas con un botón.`)) return;
            setError(undefined);
            start(async () => {
              const r = await unlinkAccount();
              if (r.error) setError(r.error);
              else router.refresh();
            });
          }}
        >
          {busy ? "Desvinculando…" : "Desvincular cuenta"}
        </button>
      </div>
    );
  }

  return (
    <ActionForm action={linkAccount} submitLabel="Vincular cuenta" successMessage="Cuenta vinculada" resetOnSuccess onSuccess={() => router.refresh()} className="space-y-4">
      <p className="meta text-xs">Escribe el correo y la contraseña de tu otra cuenta (por ejemplo, tu cuenta de EDITOR). Se pide la contraseña solo para comprobar que la cuenta es tuya; no se guarda.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="link-email">Correo de la otra cuenta</label>
          <input id="link-email" name="email" type="email" required autoComplete="off" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="link-pass">Contraseña de esa cuenta</label>
          <input id="link-pass" name="password" type="password" required autoComplete="new-password" className="input" />
        </div>
      </div>
    </ActionForm>
  );
}
