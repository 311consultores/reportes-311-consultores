"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = href === "/" ? path === "/" || path.startsWith("/reportes") : path.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]",
        active
          ? "bg-[#007AFF]/10 text-[#007AFF]"
          : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10",
      )}
    >
      {children}
    </Link>
  );
}
