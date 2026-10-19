"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { approveRegistration, rejectRegistration } from "@/app/actions/registros";
import { ActionForm } from "@/components/action-form";
import { ClientDataFields, type ClientFieldValues } from "@/components/client-data-fields";
import { useDialogs } from "@/components/dialogs";
import { suggestPrefix } from "@/lib/folio-prefix";
import type { Duplicate } from "@/lib/registro";

export function ReviewForm({
  id, suggestedPrefix, hasLogo, constanciaHref, duplicates, defaults,
}: {
  id: string;
  suggestedPrefix: string;
  hasLogo: boolean;
  constanciaHref: string | null;
  duplicates: Duplicate[];
  defaults: ClientFieldValues;
}) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [prefix, setPrefix] = useState(suggestedPrefix);
  const [touched, setTouched] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();

  async function reject() {
    const reason = await askReason({
      title: "Rechazar registro",
      message: "El registro se marca como rechazado y se borran los archivos que subió. Este motivo es interno.",
      confirmLabel: "Rechazar",
      danger: true,
    });
    if (reason === null) return;
    start(async () => {
      const r = await rejectRegistration(id, reason);
      if (r?.error) setError(r.error);
      else router.push("/registros");
    });
  }

  return (
    <div className="space-y-6">
      {duplicates.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-[#FF9500]/15 p-5 text-sm text-[#C93400] dark:text-[#FF9F0A]">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Posibles duplicados</p>
          <ul className="list-disc pl-5">
            {duplicates.map((d) => (
              <li key={`${d.kind}-${d.id}`}>
                {d.kind === "cliente" ? (
                  <>Cliente ya registrado: <Link href={`/clientes?q=${encodeURIComponent(d.companyName)}`} className="underline"><strong>{d.companyName}</strong></Link></>
                ) : (
                  <>Otro registro pendiente: <Link href={`/registros/${d.id}`} className="underline"><strong>{d.companyName}</strong></Link></>
                )} ({d.why})
              </li>
            ))}
          </ul>
          <p>Si es la misma empresa, revisa el cliente existente: desde su tarjeta en «Clientes y proyectos» puedes <strong>fusionar</strong> clientes. Si es una empresa distinta, puedes aprobarlo sin problema.</p>
        </div>
      )}

      {hasLogo && (
        <div className="card flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/registros/${id}/logo`} alt="Logo enviado" className="max-h-16 max-w-[160px] object-contain" />
          <p className="meta">Logo enviado por el cliente (se copia al catálogo al aprobar).</p>
        </div>
      )}

      <ActionForm
        action={async (prev, fd) => {
          const r = await approveRegistration(prev, fd);
          if (r?.ok) router.push("/registros");
          return r;
        }}
        submitLabel="Aprobar y agregar al catálogo"
        className="space-y-6"
        resetOnSuccess={false}
        successMessage="Registro aprobado"
      >
        <input type="hidden" name="id" value={id} />
        <ClientDataFields
          defaults={defaults}
          constanciaHref={constanciaHref}
          onCompanyName={(n) => {
            if (!touched) setPrefix(suggestPrefix(n));
          }}
        />
        <fieldset className="space-y-3 rounded-2xl border border-black/5 p-5 dark:border-white/10">
          <legend className="px-2 text-sm font-semibold tracking-tight">Catálogo de clientes</legend>
          <label className="label" htmlFor="folioPrefix">Prefijo de folio (lo define el equipo; el cliente no lo ve)</label>
          <input
            id="folioPrefix"
            name="folioPrefix"
            required
            maxLength={6}
            className="input max-w-[160px] uppercase"
            value={prefix}
            onChange={(e) => {
              setTouched(true);
              setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            }}
          />
          <p className="text-xs text-zinc-500">Se propone con las 3 primeras letras del nombre. Los folios serán como {prefix || "XXX"}001DDMMAA.</p>
        </fieldset>
      </ActionForm>

      <div className="flex items-center gap-3 border-t border-black/5 pt-4 dark:border-white/10">
        <button type="button" className="btn-outline" onClick={reject} disabled={busy}>Rechazar registro</button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
