"use client";

import { useState } from "react";
import { createClient } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { suggestPrefix } from "@/lib/folio-prefix";

/** Alta de cliente: el prefijo se propone con las 3 primeras letras del nombre y puede editarse. */
export function NewClientForm({ existing }: { existing: { prefix: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [touched, setTouched] = useState(false);

  const taken = prefix ? existing.find((e) => e.prefix === prefix.toUpperCase()) : undefined;

  return (
    <ActionForm
      action={createClient}
      submitLabel="Crear cliente"
      className="grid gap-4 md:grid-cols-3"
      onSuccess={() => {
        setName("");
        setPrefix("");
        setTouched(false);
      }}
    >
      <div>
        <label className="label">Empresa</label>
        <input
          name="companyName"
          required
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setPrefix(suggestPrefix(e.target.value));
          }}
        />
      </div>
      <div>
        <label className="label">Prefijo de folio</label>
        <input
          name="folioPrefix"
          required
          maxLength={6}
          placeholder="LAJ"
          className="input uppercase"
          value={prefix}
          onChange={(e) => {
            setTouched(true);
            setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
          }}
        />
        {taken ? (
          <p className="mt-1 text-xs text-destructive">Ya lo usa «{taken.name}». Ajústalo antes de guardar.</p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">Se propone con las 3 primeras letras; puedes cambiarlo.</p>
        )}
      </div>
      <div>
        <label className="label">Correos principales</label>
        <input name="mainEmails" required placeholder="a@x.com, b@x.com" className="input" />
      </div>
      <div className="md:col-span-3">
        <label className="label">Logo del cliente (opcional, PNG o JPG hasta 2 MB)</label>
        <input type="file" name="logo" accept="image/png,image/jpeg" className="input" />
      </div>
    </ActionForm>
  );
}
