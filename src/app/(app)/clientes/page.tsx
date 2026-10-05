import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createClient, createProject } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { DeleteEntity } from "./delete-entity";

export default async function ClientsPage() {
  await requireUser(["ADMIN"]);
  const clients = await prisma.client.findMany({
    include: { projects: { orderBy: { createdAt: "asc" } } },
    orderBy: { companyName: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="page-title">Clientes y proyectos</h1>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Nuevo cliente</h2>
        <ActionForm action={createClient} submitLabel="Crear cliente" className="grid gap-4 md:grid-cols-3">
          <div><label className="label">Empresa</label><input name="companyName" required className="input" /></div>
          <div>
            <label className="label">Prefijo de folio</label>
            <input name="folioPrefix" required maxLength={6} placeholder="CEM" className="input uppercase" />
          </div>
          <div>
            <label className="label">Correos principales</label>
            <input name="mainEmails" required placeholder="a@x.com, b@x.com" className="input" />
          </div>
        </ActionForm>
      </section>

      {clients.map((c) => (
        <section key={c.id} className="card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{c.companyName} <span className="meta font-normal">· 311{c.folioPrefix}###</span></h2>
              <p className="meta">{c.mainEmails.replaceAll(",", ", ")}</p>
            </div>
            <DeleteEntity type="CLIENT" id={c.id} />
          </div>
          <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 text-sm dark:divide-white/10 dark:border-white/10">
            {c.projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span>{p.projectName}</span>
                <span className="meta ml-auto">{p.projectEmails.replaceAll(",", ", ")}</span>
                <DeleteEntity type="PROJECT" id={p.id} />
              </li>
            ))}
            {c.projects.length === 0 && <li className="px-4 py-3 text-zinc-500">Sin proyectos</li>}
          </ul>
          <ActionForm action={createProject} submitLabel="Agregar proyecto" className="grid items-end gap-3 md:grid-cols-3">
            <input type="hidden" name="clientId" value={c.id} />
            <div><label className="label">Proyecto</label><input name="projectName" required className="input" /></div>
            <div><label className="label">Correos del proyecto</label><input name="projectEmails" required className="input" /></div>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
