import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/finanzas", label: "Resumen" },
  { href: "/finanzas/gastos", label: "Gastos" },
  { href: "/finanzas/movimientos", label: "Movimientos" },
  { href: "/finanzas/configuracion", label: "Porcentajes" },
];

export function FinanzasTabs({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]",
            active === t.href ? "bg-[#007AFF] text-white shadow-sm" : "glass text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
