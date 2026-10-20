"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteUser, toggleUserActive, updateUser } from "@/app/actions/users";
import { useDialogs } from "@/components/dialogs";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/modal";
import { PhotoField } from "@/components/photo-field";
import { BirthdayField } from "./birthday-field";

type Role = "ADMIN" | "EDITOR" | "CLIENTE";
export type PlainUser = { id: string; name: string; email: string; role: Role; clientId: string | null; photoUrl: string | null; birthday: string | null };

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
                  <input className="input" value="ADMINISTRADOR" readOnly tabIndex={-1} />
                </>
              ) : (
                <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="EDITOR">EDITOR</option>
                  <option value="ADMIN">ADMINISTRADOR</option>
                  <option value="CLIENTE">CLIENTE</option>
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
            {role !== "CLIENTE" && (
              <>
                <div><label className="label">Foto de perfil</label><PhotoField name="photo" userId={user.id} photoKey={user.photoUrl} current={user.name} /></div>
                <div><label className="label">Fecha de cumpleaños</label><BirthdayField value={user.birthday} /></div>
              </>
            )}
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

/** Eliminar un usuario (solo Administrador): pide el motivo, que queda en el Log. Si tiene historial ofrece desactivarlo. */
export function DeleteUserButton({ userId, name, active }: { userId: string; name: string; active: boolean }) {
  const [pending, start] = useTransition();
  const { askReason, confirm } = useDialogs();
  const [error, setError] = useState<string>();
  return (
    <>
    <button
      type="button"
      className="btn-outline text-red-600"
      disabled={pending}
      onClick={async () => {
        setError(undefined);
        const reason = await askReason({
          title: "Eliminar usuario",
          message: `Se eliminará a «${name}». Esta acción no se puede deshacer.`,
          confirmLabel: "Eliminar",
          danger: true,
        });
        if (reason === null) return;
        start(async () => {
          const r = await deleteUser(userId, reason);
          if (!r.error) return;
          if (r.hasHistory && active) {
            const ok = await confirm({
              title: "No se puede eliminar",
              message: `${r.error} ¿Quieres desactivarlo para quitarle el acceso? Su historial se conserva.`,
              confirmLabel: "Desactivar usuario",
            });
            if (ok) await toggleUserActive(userId);
          } else {
            setError(r.error);
          }
        });
      }}
    >
      <Trash2 size={15} /> Eliminar
    </button>
    {error && <span className="text-xs text-destructive">{error}</span>}
    </>
  );
}
