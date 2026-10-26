import Link from "next/link";
import { Megaphone, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { META_ROLES } from "@/lib/roles";
import { accessibleAccounts, isDemo, metaReady } from "@/lib/meta";

export const metadata = { title: "Campañas Meta | Portal de Operaciones" };

export default async function MetaHome() {
  const user = await requireUser(META_ROLES);
  const isAdmin = user.role === "ADMIN";
  const ready = metaReady();
  const accounts = ready ? await accessibleAccounts(user) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="page-title">Campañas Meta</h1>
          <p className="meta">Elige el cliente para ver y, próximamente, modificar sus campañas de Facebook e Instagram. Un guía te explica cada cosa en palabras simples.</p>
        </div>
        {isAdmin && <Link href="/meta/conexion" className="btn-outline"><Settings size={16} /> Conexión y accesos</Link>}
      </div>

      {isDemo() && <p className="rounded-xl bg-[#FF9500]/10 px-4 py-2 text-sm text-[#B25E00] dark:text-[#FFB340]">Modo demostración: estás viendo datos de ejemplo, no cuentas reales de Meta.</p>}

      {!ready ? (
        <div className="card space-y-2">
          <h2 className="text-lg font-semibold">Falta conectar con Meta</h2>
          <p className="meta">{isAdmin ? "Configura la conexión siguiendo la guía META.md (usuario del sistema y token) y vuelve a entrar." : "El Administrador debe terminar la conexión con Meta antes de poder usar este panel."}</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="card space-y-2">
          <h2 className="text-lg font-semibold">Todavía no tienes cuentas asignadas</h2>
          <p className="meta">{isAdmin ? "Entra a «Conexión y accesos», importa las cuentas publicitarias y asígnalas a tu equipo." : "Pídele al Administrador que te dé acceso a los clientes que vas a atender."}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <Link key={a.id} href={`/meta/${a.id}`} className="card group flex items-center gap-4 transition-all duration-200 ease-out hover:-translate-y-0.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1877F2]/12 text-[#1877F2]"><Megaphone size={22} /></span>
              <span className="min-w-0">
                <span className="block truncate font-semibold tracking-tight">{a.client?.companyName ?? a.name}</span>
                <span className="meta block truncate text-xs">{a.client ? a.name : "Sin cliente ligado"} · {a.currency ?? "—"}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
