"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ventana emergente: se cierra con la X, con Escape o al hacer clic fuera. */
export function Modal({
  open, onClose, title, subtitle, wide, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn("card glass my-auto w-full space-y-4 text-left shadow-[0_20px_60px_rgb(0,0,0,0.18)]", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="meta truncate">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-xl p-1.5 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
