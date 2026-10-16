"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { OVERDUE_COOKIE } from "@/lib/finance";

/** Aviso fijo de facturas vencidas. Se puede cerrar; vuelve a aparecer al día siguiente mientras haya vencidas. */
export function OverdueBanner({ count, total, today, dismissed }: { count: number; total: string; today: string; dismissed: boolean }) {
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) return null;

  return (
    <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl bg-[#FF3B30]/10 px-5 py-3 text-sm text-[#D70015] dark:text-[#FF453A]">
      <AlertTriangle size={18} className="shrink-0" />
      <p className="flex-1">
        <strong>{count === 1 ? "1 pago vencido" : `${count} pagos vencidos`}</strong> por {total}. Da seguimiento al cobro.{" "}
        <Link href="/facturas?estado=VENCIDA" className="font-semibold underline">Ver facturas vencidas</Link>
      </p>
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="rounded-lg p-1 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:hover:bg-white/10"
        onClick={() => {
          // Se recuerda solo por hoy: mañana vuelve a aparecer si siguen vencidas
          document.cookie = `${OVERDUE_COOKIE}=${today}; path=/; max-age=172800; samesite=lax`;
          setHidden(true);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
