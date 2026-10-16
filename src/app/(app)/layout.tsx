import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { getLogo311Key } from "@/lib/branding";
import { formatDecimal, OVERDUE_COOKIE, todayMx } from "@/lib/finance";
import { overdueSummary } from "@/lib/invoices";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { OverdueBanner } from "@/components/overdue-banner";
import { ThemeToggle } from "@/components/theme-toggle";

const ROLE_LABEL = { ADMIN: "Administrador", EDITOR: "Editor", CLIENTE: "Cliente" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [pendingDeletions, pendingRegistrations, hasLogo, overdue] = await Promise.all([
    user.role === "ADMIN" ? prisma.deletionRequest.count({ where: { status: "PENDIENTE" } }) : Promise.resolve(0),
    user.role !== "CLIENTE" ? prisma.clientRegistration.count({ where: { status: "PENDIENTE" } }) : Promise.resolve(0),
    getLogo311Key().then((k) => !!k).catch(() => false),
    user.role !== "CLIENTE" ? overdueSummary() : Promise.resolve({ count: 0, total: null }),
  ]);
  const today = todayMx();
  const bannerDismissed = (await cookies()).get(OVERDUE_COOKIE)?.value === today;

  const isStaff = user.role !== "CLIENTE";
  const isAdmin = user.role === "ADMIN";

  // Menú por rol: Operación, Administración y (abajo) Configuración
  const groups: NavGroup[] = [
    {
      id: "operacion",
      title: "Operación",
      items: [
        { href: "/", label: "Reportes", icon: "reportes" },
        ...(isStaff
          ? [
              { href: "/clientes", label: "Clientes y proyectos", icon: "clientes" as const },
              { href: "/registros", label: "Registro de clientes", icon: "registros" as const, badge: pendingRegistrations },
            ]
          : []),
      ],
    },
    {
      id: "administracion",
      title: "Administración",
      items: [
        { href: "/facturas", label: "Facturas", icon: "facturas", badge: overdue.count },
        ...(isAdmin ? [{ href: "/finanzas", label: "Finanzas", icon: "finanzas" as const }] : []),
      ],
    },
  ];
  const bottomGroups: NavGroup[] = isAdmin
    ? [
        {
          id: "configuracion",
          title: "Configuración",
          items: [
            { href: "/configuracion", label: "General", icon: "general" },
            { href: "/eliminaciones", label: "Log", icon: "log", badge: pendingDeletions },
            { href: "/usuarios", label: "Usuarios", icon: "usuarios" },
          ],
        },
      ]
    : [];

  const brand = (
    <>
      {hasLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/api/branding/logo" alt="311 Consultores" className="mb-1 max-h-12 max-w-[170px] object-contain" />
      ) : (
        <p className="text-lg font-semibold tracking-tight">311 CONSULTORES</p>
      )}
      <p className="meta">Portal de Operaciones</p>
    </>
  );

  const footer = (
    <div>
      <p className="px-3 text-sm font-medium">{user.name}</p>
      <p className="meta px-3 pb-2">{ROLE_LABEL[user.role]}</p>
      <div className="flex items-center gap-1">
        <form action={logout} className="flex-1">
          <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.98] dark:text-zinc-300 dark:hover:bg-white/10">
            <LogOut size={18} /> Cerrar sesión
          </button>
        </form>
        {isStaff && <ThemeToggle />}
      </div>
    </div>
  );

  return (
    <AppShell brand={brand} groups={groups} bottomGroups={bottomGroups} footer={footer}>
      {overdue.count > 0 && (
        <OverdueBanner count={overdue.count} total={formatDecimal(overdue.total ?? 0)} today={today} dismissed={bannerDismissed} />
      )}
      {children}
    </AppShell>
  );
}
