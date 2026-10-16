/** Cabecera de las pantallas públicas (login, recuperar, registro): solo el logo y el subtítulo «Portal de Operaciones». */
export function PortalBrand({ hasLogo }: { hasLogo: boolean }) {
  return (
    <>
      {hasLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/api/branding/logo" alt="311 Consultores" className="mx-auto max-h-16 max-w-[220px] object-contain" />
      ) : (
        <p className="text-xl font-semibold tracking-tight">311 CONSULTORES</p> // respaldo mientras no se carga el logo
      )}
      <p className="meta">Portal de Operaciones</p>
    </>
  );
}
