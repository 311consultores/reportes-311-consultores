"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

type State = { error?: string; ok?: boolean } | undefined;

export function ActionForm({
  action,
  submitLabel,
  className,
  children,
  onSuccess,
  successMessage = "Guardado correctamente",
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  submitLabel: string;
  className?: string;
  children: React.ReactNode;
  /** Se ejecuta al guardar con éxito (después de limpiar el formulario). */
  onSuccess?: () => void;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={ref}
      className={className}
      // React 19 vacía el formulario tras cada <form action>; se envía a mano para conservar
      // lo escrito cuando hay un error de validación y limpiar solo cuando se guarda.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {children}
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-[#248A3D] dark:text-[#30D158]">{successMessage}</p>}
      <div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
