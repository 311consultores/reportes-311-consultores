import { cookies } from "next/headers";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { getLogo311Key } from "@/lib/branding";
import { formatDecimal, OVERDUE_COOKIE, todayMx } from "@/lib/finance";
import { overdueSummary } from "@/lib/invoices";
import { AppShell, type NavGroup } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { PwaRegister } from "@/components/pwa-register";
import { NotificationBell } from "@/components/notification-bell";
import { OverdueBanner } from "@/components/overdue-banner";
import { ThemeToggle } from "@/components/theme-toggle";

const ROLE_LABEL = { ADMIN: "Administrador", EDITOR: "Editor", CLIENTE: "Cliente", TEAM_311: "TEAM 311" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const isOps = isAdmin || user.role === "EDITOR"; // personal de operación
  const isTeam = user.role === "TEAM_311";

  const [pendingDeletions, pendingEdits, pendingRegistrations, hasLogo, overdue, tasksToReview, unreadNotifications] = await Promise.all([
    isAdmin ? prisma.deletionRequest.count({ where: { status: "PENDIENTE" } }) : Promise.resolve(0), // las de edición se suman en el globo del Log
    isOps ? prisma.editRequest.count({ where: { status: "PENDIENTE" } }) : Promise.resolve(0),
    isOps ? prisma.clientRegistration.count({ where: { status: "PENDIENTE" } }) : Promise.resolve(0),
    getLogo311Key().then((k) => !!k).catch(() => false),
    isOps ? overdueSummary() : Promise.resolve({ count: 0, total: null }),
    isOps ? prisma.task.count({ where: { status: "PARA_REVISAR" } }) : Promise.resolve(0), // tareas esperando revisión
    user.role !== "CLIENTE" ? prisma.notification.count({ where: { userId: user.id, readAt: null } }) : Promise.resolve(0),
  ]);
  const today = todayMx();
  const bannerDismissed = (await cookies()).get(OVERDUE_COOKIE)?.value === today;

  // Menú por rol: Operación, Administración y (abajo) Configuración
  const groups: NavGroup[] = [
    {
      id: "operacion",
      title: "Operación",
      items: [
        ...(user.role !== "CLIENTE" ? [{ href: "/tareas", label: "Tareas", icon: "tareas" as const, badge: tasksToReview }] : []),
        { href: "/", label: "Reportes", icon: "reportes", badge: pendingEdits },
        ...(isOps
          ? [
              { href: "/clientes", label: "Clientes y proyectos", icon: "clientes" as const },
              { href: "/registros", label: "Registro de clientes", icon: "registros" as const, badge: pendingRegistrations },
            ]
          : []),
      ],
    },
    ...(!isTeam
      ? [
          {
            id: "administracion",
            title: "Administración",
            items: [
              { href: "/facturas", label: "Facturas", icon: "facturas" as const, badge: overdue.count },
              ...(isAdmin ? [{ href: "/finanzas", label: "Finanzas", icon: "finanzas" as const }] : []),
            ],
          },
        ]
      : []),
  ];
  const bottomGroups: NavGroup[] = isAdmin
    ? [
        {
          id: "configuracion",
          title: "Configuración",
          items: [
            { href: "/configuracion", label: "General", icon: "general" },
            { href: "/eliminaciones", label: "Log", icon: "log", badge: pendingDeletions + pendingEdits },
            { href: "/usuarios", label: "Usuarios", icon: "usuarios" },
            { href: "/aplicacion", label: "App y avisos", icon: "app" },
          ],
        },
      ]
    : user.role === "EDITOR"
      ? [{ id: "configuracion", title: "Configuración", items: [{ href: "/usuarios", label: "Usuarios", icon: "usuarios" }, { href: "/aplicacion", label: "App y avisos", icon: "app" }] }]
      : user.role === "TEAM_311"
        ? [{ id: "configuracion", title: "Configuración", items: [{ href: "/aplicacion", label: "App y avisos", icon: "app" }] }]
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

  const identity = (
    <>
      <p className="truncate text-sm font-medium">{user.name}</p>
      <p className="meta pb-2">{ROLE_LABEL[user.role]}</p>
    </>
  );
  const footer = (
    <div>
      {user.role !== "CLIENTE" ? (
        <Link href="/perfil" className="mx-1 mb-1 flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all duration-200 ease-out hover:bg-black/5 dark:hover:bg-white/10" title="Mi perfil">
          <Avatar name={user.name} userId={user.id} photoKey={user.photoUrl} size={34} />
          <span className="min-w-0">{identity}</span>
        </Link>
      ) : (
        <div className="px-3">{identity}</div>
      )}
      <div className="flex items-center gap-1">
        <form action={logout} className="flex-1">
          <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-all duration-200 ease-out hover:bg-black/5 active:scale-[0.98] dark:text-zinc-300 dark:hover:bg-white/10">
            <LogOut size={18} /> Cerrar sesión
          </button>
        </form>
        {user.role !== "CLIENTE" && <NotificationBell initialUnread={unreadNotifications} />}
        {user.role !== "CLIENTE" && <ThemeToggle />}
      </div>
    </div>
  );

  return (
    <AppShell brand={brand} groups={groups} bottomGroups={bottomGroups} footer={footer}>
      {overdue.count > 0 && (
        <OverdueBanner count={overdue.count} total={formatDecimal(overdue.total ?? 0)} today={today} dismissed={bannerDismissed} />
      )}
      {children}
      {user.role !== "CLIENTE" && <PwaRegister />}
    </AppShell>
  );
}
