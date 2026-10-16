"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, ChevronDown, FileText, Menu, Receipt, ScrollText, Settings, Users, UserPlus, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { reportes: FileText, clientes: Building2, registros: UserPlus, facturas: Receipt, finanzas: Wallet, general: Settings, log: ScrollText, usuarios: Users };
export type IconName = keyof typeof ICONS;

export type NavItem = { href: string; label: string; icon: IconName; badge?: number };
export type NavGroup = { id: string; title: string; items: NavItem[] };

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" || path.startsWith("/reportes") : path === href || path.startsWith(href + "/");

const Badge = ({ n, className }: { n: number; className?: string }) => (
  <span className={cn("rounded-full bg-[#FF3B30] px-2 py-0.5 text-xs font-semibold text-white", className)}>{n}</span>
);

function Group({ group, open, onToggle, path }: { group: NavGroup; open: boolean; onToggle: () => void; path: string }) {
  const total = group.items.reduce((s, i) => s + (i.badge ?? 0), 0);
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-all duration-200 ease-out hover:bg-black/5 dark:hover:bg-white/10"
      >
        <span className="flex-1 text-left">{group.title}</span>
        {!open && total > 0 && <Badge n={total} />}
        <ChevronDown size={14} className={cn("transition-transform duration-200 ease-out", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((it) => {
            const Icon = ICONS[it.icon];
            const active = isActive(path, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]",
                  active ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10",
                )}
              >
                <Icon size={18} /> {it.label}
                {!!it.badge && <Badge n={it.badge} className="ml-auto" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Estructura de la aplicación: menú lateral con grupos desplegables (en celular y tableta se oculta tras un botón). */
export function AppShell({
  brand, groups, bottomGroups, footer, children,
}: {
  brand: React.ReactNode;
  groups: NavGroup[];
  bottomGroups: NavGroup[];
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const all = [...groups, ...bottomGroups];
  const activeGroup = all.find((g) => g.items.some((i) => isActive(path, i.href)))?.id;
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => Object.fromEntries(all.map((g) => [g.id, g.id === activeGroup])));
  const [drawer, setDrawer] = useState(false);

  // Al entrar a una pantalla nueva: su grupo se abre (los demás se quedan como estén) y el menú móvil se cierra
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    setSeenPath(path);
    setDrawer(false);
    if (activeGroup) setOpenMap((m) => (m[activeGroup] ? m : { ...m, [activeGroup]: true }));
  }

  const toggle = (id: string) => setOpenMap((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div className="flex min-h-screen">
      <header className="glass fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-3 border-x-0 border-t-0 px-4 lg:hidden">
        <button type="button" aria-label="Abrir menú" onClick={() => setDrawer(true)} className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.95] dark:hover:bg-white/10">
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold tracking-tight">Portal de Operaciones</span>
      </header>

      {drawer && <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)} aria-hidden />}

      <aside
        className={cn(
          "glass fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-y-0 border-l-0 p-4 transition-transform duration-200 ease-out",
          "lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:translate-x-0",
          drawer ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-start justify-between px-3 pt-2">
          <div>{brand}</div>
          <button type="button" aria-label="Cerrar menú" onClick={() => setDrawer(false)} className="rounded-xl p-1.5 hover:bg-black/5 lg:hidden dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto">
          {groups.map((g) => <Group key={g.id} group={g} open={!!openMap[g.id]} onToggle={() => toggle(g.id)} path={path} />)}
        </nav>
        <div className="space-y-2 border-t border-black/5 pt-3 dark:border-white/10">
          {bottomGroups.map((g) => <Group key={g.id} group={g} open={!!openMap[g.id]} onToggle={() => toggle(g.id)} path={path} />)}
          {footer}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pt-20 lg:p-10">{children}</main>
    </div>
  );
}
