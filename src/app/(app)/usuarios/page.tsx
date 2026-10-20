import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toggleUserActive } from "@/app/actions/users";
import { Avatar } from "@/components/avatar";
import { formatBirthday } from "./birthday-field";
import { TeamEditor } from "./team-editor";
import { UserTabs, type UserRow } from "./user-tabs";
import { DeleteUserButton, UserEditor } from "./user-editor";

const ROLE_LABEL = { ADMIN: "Administrador", EDITOR: "Editor", CLIENTE: "Cliente", TEAM_311: "TEAM 311" } as const;

export default async function UsersPage() {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const isAdmin = me.role === "ADMIN";
  const [users, clients] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { projectAccess: { select: { projectId: true } }, clientAccess: { select: { clientId: true } } },
    }),
    prisma.client.findMany({ orderBy: { companyName: "asc" }, include: { projects: { orderBy: { projectName: "asc" } } } }),
  ]);
  const assign = clients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }));
  const companies = clients.map((c) => ({ id: c.id, name: c.companyName }));
  const initialTab = (await cookies()).get("usuarios_tab")?.value ?? "TODOS";

  // El Editor ve a todos, pero solo gestiona a los TEAM 311; el Administrador gestiona a todos
  const rows: UserRow[] = users.map((u) => {
    const manage = isAdmin || u.role === "TEAM_311";
    return {
      id: u.id,
      role: u.role,
      active: u.active,
      text: `${u.name} ${u.email}`,
      node: (
        <tr key={u.id} className={u.active ? undefined : "opacity-60"}>
          <td className="td">
            <span className="flex items-center gap-2.5">
              {u.role !== "CLIENTE" && <Avatar name={u.name} userId={u.id} photoKey={u.photoUrl} size={32} />}
              {u.name}
            </span>
          </td>
          <td className="td">{u.email}</td>
          <td className="td">{ROLE_LABEL[u.role]}</td>
          <td className="td whitespace-nowrap">{u.role !== "CLIENTE" ? formatBirthday(u.birthday) : "—"}</td>
          <td className="td">{u.role === "TEAM_311" ? u.projectAccess.length : "—"}</td>
          <td className="td">
            {u.active ? "Activo" : <span className="rounded-full bg-zinc-500/15 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">Inactivo</span>}
          </td>
          <td className="td">
            <div className="flex items-center justify-end gap-2">
              {u.role === "TEAM_311" && (
                <TeamEditor user={{ id: u.id, name: u.name, photoUrl: u.photoUrl, birthday: u.birthday, projectIds: u.projectAccess.map((p) => p.projectId) }} assign={assign} email={isAdmin ? u.email : undefined} />
              )}
              {isAdmin && u.role !== "TEAM_311" && (
                <UserEditor
                  user={{ id: u.id, name: u.name, email: u.email, role: u.role, clientId: u.clientAccess[0]?.clientId ?? null, photoUrl: u.photoUrl, birthday: u.birthday }}
                  companies={companies}
                  isSelf={u.id === me.id}
                />
              )}
              {manage && u.id !== me.id && (
                <form action={toggleUserActive.bind(null, u.id)}>
                  <button className="btn-outline">{u.active ? "Desactivar" : "Activar"}</button>
                </form>
              )}
              {isAdmin && u.id !== me.id && <DeleteUserButton userId={u.id} name={u.name} active={u.active} />}
            </div>
          </td>
        </tr>
      ),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="page-title">Usuarios</h1>
      <UserTabs rows={rows} isAdmin={isAdmin} companies={companies} assign={assign} initialTab={initialTab} />
    </div>
  );
}
