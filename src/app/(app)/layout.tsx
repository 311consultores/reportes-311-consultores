import { FileText, Building2, Users, Trash2, LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { NavLink } from "@/components/nav-link";

const ROLE_LABEL = { ADMIN: "Administrador", EDITOR: "Editor", CLIENTE: "Cliente" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pendingDeletions =
    user.role === "ADMIN" ? await prisma.deletionRequest.count({ where: { status: "PENDIENTE" } }) : 0;

  return (
    <div className="flex min-h-screen">
      <aside className="glass sticky top-0 z-10 flex h-screen w-64 shrink-0 flex-col border-y-0 border-l-0 p-4">
        <div className="mb-8 px-3 pt-2">
          <p className="text-lg font-semibold tracking-tight">311 CONSULTORES</p>
          <p className="meta">Reportes</p>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink href="/"><FileText size={18} /> Reportes</NavLink>
          {user.role === "ADMIN" && (
            <>
              <NavLink href="/clientes"><Building2 size={18} /> Clientes y proyectos</NavLink>
              <NavLink href="/usuarios"><Users size={18} /> Usuarios</NavLink>
              <NavLink href="/eliminaciones">
                <Trash2 size={18} /> Eliminaciones
                {pendingDeletions > 0 && (
                  <span className="ml-auto rounded-full bg-[#FF3B30] px-2 py-0.5 text-xs font-semibold text-white">
                    {pendingDeletions}
                  </span>
                )}
              </NavLink>
            </>
          )}
        </nav>
        <div className="border-t border-black/5 pt-3 dark:border-white/10">
          <p className="px-3 text-sm font-medium">{user.name}</p>
          <p className="meta px-3 pb-2">{ROLE_LABEL[user.role]}</p>
          <form action={logout}>
            <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.98] dark:text-zinc-300 dark:hover:bg-white/10">
              <LogOut size={18} /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-10">{children}</main>
    </div>
  );
}
