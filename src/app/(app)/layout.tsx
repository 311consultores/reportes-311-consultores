import { FileText, Building2, Users, Trash2, LogOut, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { getLogo311Key } from "@/lib/branding";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";

const ROLE_LABEL = { ADMIN: "Administrador", EDITOR: "Editor", CLIENTE: "Cliente" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [pendingDeletions, hasLogo] = await Promise.all([
    user.role === "ADMIN" ? prisma.deletionRequest.count({ where: { status: "PENDIENTE" } }) : Promise.resolve(0),
    getLogo311Key().then((k) => !!k).catch(() => false),
  ]);

  return (
    <div className="flex min-h-screen">
      <aside className="glass sticky top-0 z-10 flex h-screen w-64 shrink-0 flex-col border-y-0 border-l-0 p-4">
        <div className="mb-8 px-3 pt-2">
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/branding/logo" alt="311 Consultores" className="mb-1 max-h-12 max-w-[170px] object-contain" />
          ) : (
            <p className="text-lg font-semibold tracking-tight">311 CONSULTORES</p>
          )}
          <p className="meta">Reportes</p>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink href="/"><FileText size={18} /> Reportes</NavLink>
          {user.role !== "CLIENTE" && (
            <NavLink href="/clientes"><Building2 size={18} /> Clientes y proyectos</NavLink>
          )}
          {user.role === "ADMIN" && (
            <>
              <NavLink href="/usuarios"><Users size={18} /> Usuarios</NavLink>
              <NavLink href="/eliminaciones">
                <Trash2 size={18} /> Eliminaciones
                {pendingDeletions > 0 && (
                  <span className="ml-auto rounded-full bg-[#FF3B30] px-2 py-0.5 text-xs font-semibold text-white">
                    {pendingDeletions}
                  </span>
                )}
              </NavLink>
              <NavLink href="/configuracion"><Settings size={18} /> Configuración</NavLink>
            </>
          )}
        </nav>
        <div className="border-t border-black/5 pt-3 dark:border-white/10">
          <p className="px-3 text-sm font-medium">{user.name}</p>
          <p className="meta px-3 pb-2">{ROLE_LABEL[user.role]}</p>
          <div className="flex items-center gap-1">
            <form action={logout} className="flex-1">
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.98] dark:text-zinc-300 dark:hover:bg-white/10">
                <LogOut size={18} /> Cerrar sesión
              </button>
            </form>
            {user.role !== "CLIENTE" && <ThemeToggle />}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-10">{children}</main>
    </div>
  );
}
