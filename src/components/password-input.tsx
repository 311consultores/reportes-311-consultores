"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Campo de contraseña con ojito para ver lo que se escribió. */
export function PasswordInput({
  id,
  name,
  autoComplete = "current-password",
  minLength,
}: {
  id: string;
  name: string;
  autoComplete?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className="input pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-all duration-200 ease-out hover:bg-black/5 hover:text-zinc-900 active:scale-[0.95] dark:hover:bg-white/10 dark:hover:text-zinc-100"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
