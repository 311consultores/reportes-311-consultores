"use client";

import { updateMyProfile } from "@/app/actions/users";
import { ActionForm } from "@/components/action-form";
import { PhotoField } from "@/components/photo-field";

/** «Mi perfil»: foto y cumpleaños del propio TEAM 311. */
export function ProfileForm({ name, userId, photoKey, children }: { name: string; userId: string; photoKey: string | null; children: React.ReactNode }) {
  return (
    <ActionForm action={updateMyProfile} submitLabel="Guardar mi perfil" successMessage="Perfil actualizado" resetOnSuccess={false} className="space-y-4">
      <div><label className="label">Foto de perfil</label><PhotoField name="photo" userId={userId} photoKey={photoKey} current={name} /></div>
      {children}
    </ActionForm>
  );
}
