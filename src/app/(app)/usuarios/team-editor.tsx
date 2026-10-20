"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateTeamUser } from "@/app/actions/users";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { PhotoField } from "@/components/photo-field";
import { AssignmentsField, type AssignClient } from "./assignments-field";
import { BirthdayField } from "./birthday-field";

export type TeamUser = { id: string; name: string; photoUrl: string | null; birthday: string | null; projectIds: string[] };

/** Edición de un usuario TEAM 311 o PROJECT 311: nombre, foto, cumpleaños, proyectos asignados y nueva contraseña (opcional). */
export function TeamEditor({ user, assign, email, roleLabel = "TEAM 311", showProjects = true }: { user: TeamUser; assign: AssignClient[]; email?: string; roleLabel?: string; showProjects?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}><Pencil size={15} /> Editar</button>
      <Modal open={open} onClose={() => setOpen(false)} wide title={`Editar: ${user.name}`} subtitle={`Usuario ${roleLabel}`}>
        <ActionForm action={updateTeamUser} submitLabel="Guardar cambios" successMessage="Cambios guardados" resetOnSuccess={false} className="space-y-4" onSuccess={() => setTimeout(() => setOpen(false), 800)}>
          <input type="hidden" name="id" value={user.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Nombre</label><input name="name" required defaultValue={user.name} className="input" /></div>
            {email !== undefined && <div><label className="label">Correo</label><input name="email" type="email" required defaultValue={email} className="input" /></div>}
            <div><label className="label">Nueva contraseña (solo si quieres cambiarla)</label><input name="password" type="password" minLength={8} className="input" autoComplete="new-password" /></div>
            <div><label className="label">Foto de perfil</label><PhotoField name="photo" userId={user.id} photoKey={user.photoUrl} current={user.name} /></div>
            <div><label className="label">Fecha de cumpleaños</label><BirthdayField value={user.birthday} /></div>
          </div>
          {showProjects && (
            <div>
              <label className="label">Clientes y proyectos asignados</label>
              <AssignmentsField clients={assign} initial={user.projectIds} />
            </div>
          )}
        </ActionForm>
      </Modal>
    </>
  );
}
