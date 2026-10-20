import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Avatar } from "@/components/avatar";
import { BirthdayField } from "../usuarios/birthday-field";
import { ProfileForm } from "./profile-form";

const ROLE_LABEL = { ADMIN: "Administrador", EDITOR: "Editor", TEAM_311: "TEAM 311" } as const;

export default async function ProfilePage() {
  const me = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const isTeam = me.role === "TEAM_311";
  const [row, projects] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { email: true, birthday: true, photoUrl: true } }),
    prisma.project.findMany({
      where: { id: { in: me.projectAccess.map((p) => p.projectId) } },
      include: { client: { select: { companyName: true } } },
      orderBy: [{ client: { companyName: "asc" } }, { projectName: "asc" }],
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">Mi perfil</h1>

      <section className="card space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={me.name} userId={me.id} photoKey={row.photoUrl} size={64} />
          <div>
            <p className="text-lg font-semibold tracking-tight">{me.name}</p>
            <p className="meta">{row.email} · {ROLE_LABEL[me.role as keyof typeof ROLE_LABEL]}</p>
          </div>
        </div>
        <ProfileForm name={me.name} userId={me.id} photoKey={row.photoUrl}>
          <div><label className="label">Fecha de cumpleaños</label><BirthdayField value={row.birthday} /></div>
        </ProfileForm>
      </section>

      {isTeam && (
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Mis clientes y proyectos</h2>
        {projects.length === 0 ? (
          <p className="meta">Todavía no tienes proyectos asignados. Pídele al Administrador o al Editor que te los asignen.</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
            {projects.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2"><span className="font-medium">{p.client.companyName}</span><span className="text-zinc-500">{p.projectName}</span></li>
            ))}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}
