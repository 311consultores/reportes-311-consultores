"use client";

import { startTransition, useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitRegistration } from "@/app/actions/registros";
import { ClientDataFields } from "@/components/client-data-fields";
import { PRIVACY_URL } from "@/lib/client-data";

export function RegistroForm() {
  const [state, action, pending] = useActionState(submitRegistration, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 className="mx-auto text-[#34C759]" size={56} />
        <h2 className="text-xl font-semibold tracking-tight">¡Gracias! Recibimos tu registro</h2>
        <p className="meta mx-auto max-w-md">
          Nuestro equipo lo revisará y te daremos de alta. Te enviamos un correo de confirmación. Si necesitas algo,
          escríbenos a <a className="link" href="mailto:admon@311consultores.com">admon@311consultores.com</a>.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      // Envío manual: React 19 vacía los campos tras cada <form action>, y aquí un error no debe borrar lo escrito
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <ClientDataFields showLogo showConstancia />

      {/* Campo señuelo anti-spam: las personas no lo ven; los programas automáticos suelen llenarlo */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No llenar este campo
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="privacy" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#007AFF]" />
        <span>
          Acepto el{" "}
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="link">aviso de privacidad</a>.
        </span>
      </label>

      {state?.error && <p className="rounded-xl bg-[#FF3B30]/10 p-4 text-sm text-[#D70015] dark:text-[#FF453A]">{state.error}</p>}

      <button className="btn w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar registro"}
      </button>
    </form>
  );
}
