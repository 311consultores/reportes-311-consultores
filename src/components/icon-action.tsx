import { cn } from "@/lib/utils";

/** Botón de ícono con tooltip: al pasar el cursor (o enfocarlo con el teclado) explica qué hace. */
export function IconAction({
  label, onClick, danger, disabled, children,
}: {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "rounded-xl p-2 transition-all duration-200 ease-out active:scale-[0.95] disabled:opacity-40",
          danger ? "text-[#FF3B30] hover:bg-[#FF3B30]/10" : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10",
        )}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {label}
      </span>
    </span>
  );
}
