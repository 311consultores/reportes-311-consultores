import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toggleUserActive } from "@/app/actions/users";
import { Avatar } from "@/components/avatar";
import { formatBirthday } from "./birthday-field";
import { TeamEditor } from "./team-editor";
import { UserForm } from "./user-form";

const ROLE_LABEL = { ADMIN: "Administrador", EDITOR: "Editor", CLIENTE: "Cliente", TEAM_311: "TEAM 311" } as const;

export default async function UsersPage() {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const isAdmin = me.role === "ADMIN";
  const [users, clients] = await Promise.all([
    prisma.user.findMany({
      where: isAdmin ? {} : { role: "TEAM_311" }, // el Editor solo gestiona a los TEAM 311
      orderBy: { createdAt: "asc" },
      include: { projectAccess: { select: { projectId: true } } },
    }),
    prisma.client.findMany({ orderBy: { companyName: "asc" }, include: { projects: { orderBy: { projectName: "asc" } } } }),
  ]);
  const assign = clients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }));

  return (
    <div className="space-y-6">
      <h1 className="page-title">Usuarios</h1>

      <details className="card group space-y-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="btn"><Plus size={16} /> Nuevo usuario</span>
        </summary>
        <div className="pt-4">
          <UserForm isAdmin={isAdmin} companies={clients.map((c) => ({ id: c.id, name: c.companyName }))} assign={assign} />
        </div>
      </details>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-black/5 dark:border-white/10">
            <tr><th className="th">Nombre</th><th className="th">Correo</th><th className="th">Rol</th><th className="th">Cumpleaños</th><th className="th">Proyectos</th><th className="th">Estado</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td">
                  <span className="flex items-center gap-2.5">
                    {u.role === "TEAM_311" && <Avatar name={u.name} userId={u.id} photoKey={u.photoUrl} size={32} />}
                    {u.name}
                  </span>
                </td>
                <td className="td">{u.email}</td>
                <td className="td">{ROLE_LABEL[u.role]}</td>
                <td className="td whitespace-nowrap">{u.role === "TEAM_311" ? formatBirthday(u.birthday) : "—"}</td>
                <td className="td">{u.role === "TEAM_311" ? u.projectAccess.length : "—"}</td>
                <td className="td">{u.active ? "Activo" : "Inactivo"}</td>
                <td className="td">
                  <div className="flex items-center justify-end gap-2">
                    {u.role === "TEAM_311" && (
                      <TeamEditor user={{ id: u.id, name: u.name, photoUrl: u.photoUrl, birthday: u.birthday, projectIds: u.projectAccess.map((p) => p.projectId) }} assign={assign} />
                    )}
                    {u.id !== me.id && (
                      <form action={toggleUserActive.bind(null, u.id)}>
                        <button className="btn-outline">{u.active ? "Desactivar" : "Activar"}</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
