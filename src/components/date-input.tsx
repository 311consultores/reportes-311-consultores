"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Campo de fecha que abre el calendario al hacer clic en cualquier parte del campo, no solo en el icono. */
export function DateInput({ className, onClick, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      {...props}
      type="date"
      className={cn("input cursor-pointer", className)}
      onClick={(e) => {
        onClick?.(e);
        try {
          e.currentTarget.showPicker?.();
        } catch {
          /* el navegador no permite abrirlo ahora (p. ej. ya está abierto): se ignora */
        }
      }}
    />
  );
}
