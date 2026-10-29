import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { toggleUserActive } from "@/app/actions/users";
import { Avatar } from "@/components/avatar";
import { formatBirthday } from "./birthday-field";
import { TeamEditor } from "./team-editor";
import { UserTabs, type UserRow } from "./user-tabs";
import { DeleteUserButton, UserEditor } from "./user-editor";

export default async function UsersPage() {
  const me = await requireUser(["ADMIN", "EDITOR"]);
  const isAdmin = me.role === "ADMIN";
  const [users, clients, areaList] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { projectAccess: { select: { projectId: true } }, clientAccess: { select: { clientId: true } }, areas: { select: { areaId: true } } },
    }),
    prisma.client.findMany({ orderBy: { companyName: "asc" }, include: { projects: { orderBy: { projectName: "asc" } } } }),
    prisma.area.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true, active: true } }),
  ]);
  const assign = clients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }));
  const companies = clients.map((c) => ({ id: c.id, name: c.companyName }));
  const initialTab = (await cookies()).get("usuarios_tab")?.value ?? "TODOS";

  // El Editor ve a todos, pero solo gestiona a CLIENTE, TEAM 311 y PROJECT 311; el Administrador gestiona a todos
  const rows: UserRow[] = users.map((u) => {
    const isTeamType = u.role === "TEAM_311" || u.role === "PROJECT_311";
    const manage = isAdmin || isTeamType || u.role === "CLIENTE";
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
              {isTeamType && (
                <TeamEditor user={{ id: u.id, name: u.name, photoUrl: u.photoUrl, birthday: u.birthday, phone: u.phone, projectIds: u.projectAccess.map((p) => p.projectId), role: u.role, areaIds: u.areas.map((x) => x.areaId) }} assign={assign} email={isAdmin ? u.email : undefined} roleLabel={ROLE_LABEL[u.role]} areas={areaList} canChangeRole={isAdmin && u.id !== me.id} />
              )}
              {(isAdmin ? !isTeamType : u.role === "CLIENTE") && (
                <UserEditor
                  canChangeRole={isAdmin}
                  user={{ id: u.id, name: u.name, email: u.email, role: u.role as "ADMIN" | "EDITOR" | "CLIENTE", clientId: u.clientAccess[0]?.clientId ?? null, photoUrl: u.photoUrl, birthday: u.birthday }}
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
