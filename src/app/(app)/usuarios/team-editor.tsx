"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateTeamUser } from "@/app/actions/users";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { PhotoField } from "@/components/photo-field";
import { AssignmentsField, type AssignClient } from "./assignments-field";
import { BirthdayField } from "./birthday-field";

export type TeamUser = { id: string; name: string; photoUrl: string | null; birthday: string | null; phone?: string | null; projectIds: string[]; role?: string; areaIds?: string[] };
export type AreaChoice = { id: string; name: string; color: string; active: boolean };

/** Edición de un usuario TEAM 311 o PROJECT 311: nombre, foto, cumpleaños, proyectos asignados y nueva contraseña (opcional). */
export function TeamEditor({ user, assign, email, roleLabel = "TEAM 311", areas = [], canChangeRole = false }: { user: TeamUser; assign: AssignClient[]; email?: string; roleLabel?: string; areas?: AreaChoice[]; canChangeRole?: boolean }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role ?? "TEAM_311");
  const showProjects = role === "TEAM_311";
  const isTeam = role === "TEAM_311" || role === "PROJECT_311";
  return (
    <>
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}><Pencil size={15} /> Editar</button>
      <Modal open={open} onClose={() => setOpen(false)} wide title={`Editar: ${user.name}`} subtitle={`Usuario ${roleLabel}`}>
        <ActionForm action={updateTeamUser} submitLabel="Guardar cambios" successMessage="Cambios guardados" resetOnSuccess={false} className="space-y-4" onSuccess={() => setTimeout(() => setOpen(false), 800)}>
          <input type="hidden" name="id" value={user.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Nombre</label><input name="name" required defaultValue={user.name} className="input" /></div>
            {email !== undefined && <div><label className="label">Correo</label><input name="email" type="email" required defaultValue={email} className="input" /></div>}
            {canChangeRole && (
              <div>
                <label className="label">Rol</label>
                <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="TEAM_311">TEAM 311</option>
                  <option value="PROJECT_311">PROJECT 311</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="ADMIN">ADMINISTRADOR</option>
                </select>
              </div>
            )}
            <div><label className="label">Nueva contraseña (solo si quieres cambiarla)</label><input name="password" type="password" minLength={8} className="input" autoComplete="new-password" /></div>
            <div><label className="label">Foto de perfil</label><PhotoField name="photo" userId={user.id} photoKey={user.photoUrl} current={user.name} /></div>
            <div><label className="label">Fecha de cumpleaños</label><BirthdayField value={user.birthday} /></div>
            <div><label className="label">Teléfono / WhatsApp (opcional)</label><input name="phone" type="tel" inputMode="tel" maxLength={20} defaultValue={user.phone ?? ""} placeholder="10 dígitos" className="input" /></div>
          </div>
          {isTeam && areas.length > 0 && (
            <div>
              <label className="label">Áreas</label>
              <div className="flex flex-wrap gap-2">
                {areas.filter((a) => a.active || user.areaIds?.includes(a.id)).map((a) => (
                  <label key={a.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-sm dark:border-white/15">
                    <input type="checkbox" name="areaIds" value={a.id} defaultChecked={user.areaIds?.includes(a.id)} className="h-4 w-4 accent-[#007AFF]" />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />{a.name}{a.active ? "" : " (desactivada)"}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">Puede pertenecer a varias áreas.</p>
            </div>
          )}

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
