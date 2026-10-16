"use client";

import { useState } from "react";
import { createUser } from "@/app/actions/users";
import { ActionForm } from "@/components/action-form";
import { PhotoField } from "@/components/photo-field";
import { AssignmentsField, type AssignClient } from "./assignments-field";
import { BirthdayField } from "./birthday-field";

type Role = "ADMIN" | "EDITOR" | "CLIENTE" | "TEAM_311";

/** Alta de usuario. El Editor solo puede crear TEAM 311; el Administrador, cualquier rol. */
export function UserForm({ isAdmin, companies, assign }: { isAdmin: boolean; companies: { id: string; name: string }[]; assign: AssignClient[] }) {
  const [role, setRole] = useState<Role>(isAdmin ? "EDITOR" : "TEAM_311");
  const [resetKey, setResetKey] = useState(0);

  return (
    <ActionForm action={createUser} submitLabel="Crear usuario" className="space-y-4" successMessage="Usuario creado" onSuccess={() => setResetKey((k) => k + 1)}>
      <div className="grid gap-4 md:grid-cols-3">
        <div><label className="label">Nombre</label><input name="name" required className="input" /></div>
        <div><label className="label">Correo</label><input name="email" type="email" required className="input" /></div>
        <div><label className="label">Contraseña</label><input name="password" type="password" minLength={8} required className="input" /></div>
        <div>
          <label className="label">Rol</label>
          {isAdmin ? (
            <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Administrador</option>
              <option value="CLIENTE">Cliente</option>
              <option value="TEAM_311">TEAM 311</option>
            </select>
          ) : (
            <>
              <input type="hidden" name="role" value="TEAM_311" />
              <input className="input" value="TEAM 311" readOnly tabIndex={-1} />
            </>
          )}
        </div>
        {role === "CLIENTE" && (
          <div>
            <label className="label">Empresa (rol Cliente)</label>
            <select name="clientId" className="input" defaultValue="">
              <option value="">—</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {role === "TEAM_311" && (
        <div key={resetKey} className="space-y-4 rounded-2xl border border-black/5 p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Perfil del TEAM 311</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Foto de perfil (opcional)</label><PhotoField name="photo" current="Nuevo" /></div>
            <div><label className="label">Fecha de cumpleaños (opcional)</label><BirthdayField /></div>
          </div>
          <div>
            <label className="label">Clientes y proyectos asignados</label>
            <AssignmentsField clients={assign} />
          </div>
        </div>
      )}
    </ActionForm>
  );
}
