import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createUser, toggleUserActive } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";

export default async function UsersPage() {
  const me = await requireUser(["ADMIN"]);
  const [users, clients] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.client.findMany({ orderBy: { companyName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Usuarios</h1>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Nuevo usuario</h2>
        <ActionForm action={createUser} submitLabel="Crear usuario" className="grid gap-4 md:grid-cols-3">
          <div><label className="label">Nombre</label><input name="name" required className="input" /></div>
          <div><label className="label">Correo</label><input name="email" type="email" required className="input" /></div>
          <div><label className="label">Contraseña</label><input name="password" type="password" minLength={8} required className="input" /></div>
          <div>
            <label className="label">Rol</label>
            <select name="role" className="input" defaultValue="EDITOR">
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Administrador</option>
              <option value="CLIENTE">Cliente</option>
            </select>
          </div>
          <div>
            <label className="label">Empresa (solo rol Cliente)</label>
            <select name="clientId" className="input" defaultValue="">
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
        </ActionForm>
      </section>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-black/5 dark:border-white/10"><tr><th className="th">Nombre</th><th className="th">Correo</th><th className="th">Rol</th><th className="th">Estado</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td">{u.name}</td><td className="td">{u.email}</td><td className="td">{u.role}</td>
                <td className="td">{u.active ? "Activo" : "Inactivo"}</td>
                <td className="td text-right">
                  {u.id !== me.id && (
                    <form action={toggleUserActive.bind(null, u.id)}>
                      <button className="btn-outline">{u.active ? "Desactivar" : "Activar"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
