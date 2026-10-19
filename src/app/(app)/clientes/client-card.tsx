"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FolderPlus, ImagePlus, Maximize2, Trash2 } from "lucide-react";
import { createProject, updateClientLogo } from "@/app/actions/admin";
import { requestDeletion } from "@/app/actions/deletions";
import { ActionForm } from "@/components/action-form";
import type { ClientFieldValues } from "@/components/client-data-fields";
import { useDialogs } from "@/components/dialogs";
import { IconAction } from "@/components/icon-action";
import { Modal } from "@/components/modal";
import { EmailPills } from "@/components/email-pills";
import { ClientProfileBody } from "./client-profile";
import { DeleteEntity } from "./delete-entity";

export type CardClient = {
  id: string;
  companyName: string;
  folioPrefix: string;
  mainEmails: string;
  logoUrl: string | null;
  reportCount: number;
  createdAt: string;
  projects: { id: string; projectName: string; projectEmails: string; responsible: string }[];
  values: ClientFieldValues;
  hasConstancia: boolean;
};

type ModalKind = null | "detalle" | "proyecto" | "fiscal" | "logo";

export function ClientCard({ client: c, isAdmin }: { client: CardClient; isAdmin: boolean }) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [modal, setModal] = useState<ModalKind>(null);
  const [error, setError] = useState<string>();
  const close = () => setModal(null);
  const logo = c.logoUrl ? `/api/clients/${c.id}/logo?v=${encodeURIComponent(c.logoUrl)}` : null;

  async function remove() {
    const reason = await askReason({
      title: "Eliminar cliente",
      message: "Esta acción no se puede deshacer. Indica por qué se elimina este cliente.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (reason === null) return;
    setError(undefined);
    const r = await requestDeletion("CLIENT", c.id, reason);
    if ("error" in r && r.error) setError(r.error);
    else router.refresh();
  }

  return (
    <article className="card flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`Logo de ${c.companyName}`} className="max-h-12 max-w-[48px] object-contain" />
          ) : (
            <span className="text-sm font-semibold text-zinc-500">{c.companyName.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-semibold tracking-tight">{c.companyName}</h2>
          <p className="meta truncate">Prefijo {c.folioPrefix} · {c.projects.length} proyecto(s)</p>
        </div>
      </header>

      <p className="meta truncate" title={c.mainEmails}>{c.mainEmails.replaceAll(",", ", ")}</p>

      <ul className="max-h-28 min-h-[3.5rem] divide-y divide-black/5 overflow-auto rounded-xl border border-black/5 text-sm dark:divide-white/10 dark:border-white/10">
        {c.projects.map((p) => (
          <li key={p.id} className="truncate px-3 py-1.5" title={`${p.projectName} · ${p.projectEmails}`}>{p.projectName}</li>
        ))}
        {c.projects.length === 0 && <li className="px-3 py-1.5 text-zinc-500">Sin proyectos</li>}
      </ul>

      <footer className="mt-auto flex items-center gap-1 border-t border-black/5 pt-2 dark:border-white/10">
        <IconAction label="Ver detalles del cliente" onClick={() => setModal("detalle")}><Maximize2 size={17} /></IconAction>
        <IconAction label="Agregar proyecto" onClick={() => setModal("proyecto")}><FolderPlus size={17} /></IconAction>
        <IconAction label="Datos fiscales y de contacto" onClick={() => setModal("fiscal")}><FileText size={17} /></IconAction>
        <IconAction label={c.logoUrl ? "Cambiar logo" : "Agregar logo"} onClick={() => setModal("logo")}><ImagePlus size={17} /></IconAction>
        {isAdmin && (
          <span className="ml-auto"><IconAction label="Eliminar cliente" danger onClick={remove}><Trash2 size={17} /></IconAction></span>
        )}
      </footer>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <Modal open={modal === "detalle"} onClose={close} wide title={c.companyName} subtitle={`Prefijo de folio ${c.folioPrefix} · alta ${c.createdAt}`}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="max-h-16 max-w-[160px] rounded-lg object-contain" />
            )}
            <div className="text-sm">
              <p className="text-xs text-zinc-500">Correos principales</p>
              <p>{c.mainEmails.replaceAll(",", ", ")}</p>
              <p className="mt-1 text-xs text-zinc-500">Reportes registrados: <strong className="text-foreground">{c.reportCount}</strong></p>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Proyectos</h3>
            <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 text-sm dark:divide-white/10 dark:border-white/10">
              {c.projects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <span className="font-medium">{p.projectName}<span className="meta ml-2 font-normal">{p.responsible ? `Responsable: ${p.responsible}` : "Sin responsable"}</span></span>
                  <span className="meta ml-auto truncate">{p.projectEmails ? p.projectEmails.replaceAll(",", ", ") : "Sin correos propios"}</span>
                  {isAdmin && <DeleteEntity type="PROJECT" id={p.id} />}
                </li>
              ))}
              {c.projects.length === 0 && <li className="px-4 py-2.5 text-zinc-500">Sin proyectos</li>}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Datos fiscales y de contacto</h3>
            <ClientProfileBody clientId={c.id} values={c.values} mainEmails={c.mainEmails} hasConstancia={c.hasConstancia} />
          </div>
        </div>
      </Modal>

      <Modal open={modal === "proyecto"} onClose={close} title="Agregar proyecto" subtitle={c.companyName}>
        <ActionForm action={createProject} submitLabel="Agregar proyecto" className="space-y-4" successMessage="Proyecto agregado" onSuccess={() => setTimeout(close, 700)}>
          <input type="hidden" name="clientId" value={c.id} />
          <div><label className="label">Proyecto</label><input name="projectName" required className="input" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Responsable del proyecto: nombre</label><input name="responsibleName" required maxLength={120} className="input" /></div>
            <div><label className="label">Apellido</label><input name="responsibleLastName" required maxLength={120} className="input" /></div>
          </div>
          <div>
            <label className="label">Correos del proyecto</label>
            {/* Se sugieren los correos principales del cliente; se pueden quitar o agregar otros. Si coinciden, el reporte se envía una sola vez */}
            <EmailPills name="projectEmails" defaultValue={c.mainEmails} />
          </div>
        </ActionForm>
      </Modal>

      <Modal open={modal === "fiscal"} onClose={close} wide title="Datos fiscales y de contacto" subtitle={c.companyName}>
        <ClientProfileBody clientId={c.id} values={c.values} mainEmails={c.mainEmails} hasConstancia={c.hasConstancia} editOpen />
      </Modal>

      <Modal open={modal === "logo"} onClose={close} title={c.logoUrl ? "Cambiar logo" : "Agregar logo"} subtitle={c.companyName}>
        <ActionForm action={updateClientLogo} submitLabel="Guardar logo" className="space-y-4" successMessage="Logo actualizado" onSuccess={() => setTimeout(close, 700)}>
          <input type="hidden" name="clientId" value={c.id} />
          <div>
            <label className="label">Imagen (PNG o JPG, hasta 2 MB)</label>
            <input type="file" name="logo" accept="image/png,image/jpeg" required className="input" />
          </div>
        </ActionForm>
      </Modal>
    </article>
  );
}
