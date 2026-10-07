import { requireUser } from "@/lib/auth";
import { getLogo311Key } from "@/lib/branding";
import { uploadLogo311 } from "@/app/actions/settings";
import { ActionForm } from "@/components/action-form";

export default async function SettingsPage() {
  await requireUser(["ADMIN"]);
  const hasLogo = !!(await getLogo311Key());

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">Configuración</h1>

      <section className="card space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Logo de 311 Consultores</h2>
          <p className="meta">
            Aparece en el inicio de sesión, el menú, el encabezado de los reportes, el PDF y los correos. PNG o JPG de hasta 2 MB.
          </p>
        </div>

        {hasLogo ? (
          <div className="rounded-xl border border-black/5 bg-white p-4 dark:border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/branding/logo" alt="Logo actual" className="max-h-20 max-w-full object-contain" />
          </div>
        ) : (
          <p className="meta">Todavía no hay un logo cargado.</p>
        )}

        <ActionForm
          action={uploadLogo311}
          submitLabel={hasLogo ? "Reemplazar logo" : "Subir logo"}
          className="space-y-4"
          successMessage="Logo actualizado"
        >
          <input type="file" name="logo" accept="image/png,image/jpeg" required className="input" />
        </ActionForm>
      </section>
    </div>
  );
}
