"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean };
type ReasonOptions = ConfirmOptions & { reasonLabel?: string; minLength?: number };

type Dialogs = {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  askReason: (o: ReasonOptions) => Promise<string | null>;
};

const Ctx = createContext<Dialogs | null>(null);

export function useDialogs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDialogs debe usarse dentro de <DialogProvider>");
  return v;
}

type Active =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "reason"; opts: ReasonOptions; resolve: (v: string | null) => void };

/** Modales propios del sistema (reemplazan confirm/prompt del navegador). */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const [reason, setReason] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setActive({ kind: "confirm", opts, resolve })),
    [],
  );
  const askReason = useCallback(
    (opts: ReasonOptions) =>
      new Promise<string | null>((resolve) => {
        setReason("");
        setActive({ kind: "reason", opts, resolve });
      }),
    [],
  );

  function close(result: boolean | string | null) {
    if (!active) return;
    if (active.kind === "confirm") active.resolve(result === true);
    else active.resolve(typeof result === "string" ? result : null);
    setActive(null);
  }

  useEffect(() => {
    if (!active) return;
    (active.kind === "reason" ? area.current : confirmBtn.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(active.kind === "confirm" ? false : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const min = active?.kind === "reason" ? (active.opts.minLength ?? 3) : 0;
  const reasonOk = reason.trim().length >= min;

  return (
    <Ctx.Provider value={{ confirm, askReason }}>
      {children}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && close(active.kind === "confirm" ? false : null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="card glass w-full max-w-md space-y-4 shadow-[0_20px_60px_rgb(0,0,0,0.18)]">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">{active.opts.title}</h2>
              {active.opts.message && <p className="meta">{active.opts.message}</p>}
            </div>

            {active.kind === "reason" && (
              <div>
                <label className="label">{active.opts.reasonLabel ?? "Motivo"}</label>
                <textarea
                  ref={area}
                  className="input"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Escribe el motivo (mínimo 3 caracteres)"
                />
                <p className="mt-1 text-xs text-zinc-500">El motivo queda registrado en el historial.</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => close(active.kind === "confirm" ? false : null)}>
                Cancelar
              </button>
              <button
                ref={confirmBtn}
                className={active.opts.danger ? "btn-danger" : "btn"}
                disabled={active.kind === "reason" && !reasonOk}
                onClick={() => close(active.kind === "confirm" ? true : reason.trim())}
              >
                {active.opts.confirmLabel ?? "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
