import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createProject, updateClientLogo } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { DeleteEntity } from "./delete-entity";
import { NewClientForm } from "./new-client-form";

export default async function ClientsPage() {
  const user = await requireUser(["ADMIN", "EDITOR"]);
  const isAdmin = user.role === "ADMIN"; // solo el Admin elimina clientes y proyectos
  const clients = await prisma.client.findMany({
    include: { projects: { orderBy: { createdAt: "asc" } } },
    orderBy: { companyName: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="page-title">Clientes y proyectos</h1>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Nuevo cliente</h2>
        <NewClientForm existing={clients.map((c) => ({ prefix: c.folioPrefix, name: c.companyName }))} />
      </section>

      {clients.map((c) => (
        <section key={c.id} className="card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {c.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/clients/${c.id}/logo?v=${encodeURIComponent(c.logoUrl)}`}
                  alt={`Logo de ${c.companyName}`}
                  className="max-h-14 max-w-[120px] rounded-lg object-contain"
                />
              )}
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {c.companyName} <span className="meta font-normal">· {c.folioPrefix}001DDMMAA</span>
                </h2>
                <p className="meta">{c.mainEmails.replaceAll(",", ", ")}</p>
              </div>
            </div>
            {isAdmin && <DeleteEntity type="CLIENT" id={c.id} />}
          </div>
          <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 text-sm dark:divide-white/10 dark:border-white/10">
            {c.projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span>{p.projectName}</span>
                <span className="meta ml-auto">{p.projectEmails.replaceAll(",", ", ")}</span>
                {isAdmin && <DeleteEntity type="PROJECT" id={p.id} />}
              </li>
            ))}
            {c.projects.length === 0 && <li className="px-4 py-3 text-zinc-500">Sin proyectos</li>}
          </ul>
          <ActionForm action={createProject} submitLabel="Agregar proyecto" className="grid items-end gap-3 md:grid-cols-3">
            <input type="hidden" name="clientId" value={c.id} />
            <div><label className="label">Proyecto</label><input name="projectName" required className="input" /></div>
            <div><label className="label">Correos del proyecto</label><input name="projectEmails" required className="input" /></div>
          </ActionForm>
          <details>
            <summary className="link cursor-pointer text-sm">{c.logoUrl ? "Cambiar logo" : "Agregar logo"}</summary>
            <ActionForm
              action={updateClientLogo}
              submitLabel="Guardar logo"
              className="mt-3 flex flex-wrap items-end gap-3"
              successMessage="Logo actualizado"
            >
              <input type="hidden" name="clientId" value={c.id} />
              <input type="file" name="logo" accept="image/png,image/jpeg" required className="input max-w-sm" />
            </ActionForm>
          </details>
        </section>
      ))}
    </div>
  );
}
