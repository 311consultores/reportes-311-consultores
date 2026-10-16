"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteUser, updateUser } from "@/app/actions/users";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";

type Role = "ADMIN" | "EDITOR" | "CLIENTE";
export type PlainUser = { id: string; name: string; email: string; role: Role; clientId: string | null };

/** Edición de un usuario Administrador, Editor o Cliente (solo lo ve el Administrador). */
export function UserEditor({ user, companies, isSelf }: { user: PlainUser; companies: { id: string; name: string }[]; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  return (
    <>
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}><Pencil size={15} /> Editar</button>
      <Modal open={open} onClose={() => setOpen(false)} wide title={`Editar: ${user.name}`}>
        <ActionForm action={updateUser} submitLabel="Guardar cambios" successMessage="Cambios guardados" resetOnSuccess={false} className="space-y-4" onSuccess={() => setTimeout(() => setOpen(false), 800)}>
          <input type="hidden" name="id" value={user.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Nombre</label><input name="name" required defaultValue={user.name} className="input" /></div>
            <div><label className="label">Correo</label><input name="email" type="email" required defaultValue={user.email} className="input" /></div>
            <div><label className="label">Nueva contraseña (solo si quieres cambiarla)</label><input name="password" type="password" minLength={8} className="input" autoComplete="new-password" /></div>
            <div>
              <label className="label">Rol</label>
              {isSelf ? (
                <>
                  <input type="hidden" name="role" value="ADMIN" />
                  <input className="input" value="Administrador" readOnly tabIndex={-1} />
                </>
              ) : (
                <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="EDITOR">Editor</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="CLIENTE">Cliente</option>
                </select>
              )}
            </div>
            {role === "CLIENTE" && (
              <div>
                <label className="label">Empresa (rol Cliente)</label>
                <select name="clientId" className="input" defaultValue={user.clientId ?? ""}>
                  <option value="">—</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

/** Eliminar un usuario (con confirmación). Si tiene historial, el sistema lo impide y explica por qué. */
export function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-outline text-red-600"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`¿Eliminar al usuario «${name}»? Esta acción no se puede deshacer.`)) return;
        start(async () => {
          const r = await deleteUser(userId);
          if (r.error) window.alert(r.error);
        });
      }}
    >
      <Trash2 size={15} /> Eliminar
    </button>
  );
}
