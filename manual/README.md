# Manual de uso (asistente / rol Editor)

Entregable: **`Manual-de-uso-311-Consultores.pdf`** (en esta carpeta). No se publica en el sistema ni en Internet.

Las capturas se toman del sistema local con **datos de ejemplo inventados** (nunca de producción).

## Regenerar el manual (si cambia el sistema)

Desde la raíz del proyecto, con la base de datos **local** y `npm run dev` corriendo en el puerto 3000:

```bash
cd manual && npm install && cd ..          # solo la primera vez
node manual/make-assets.mjs                 # logos y fotos de ejemplo (assets/)
npx tsx --env-file=.env manual/seed-demo.ts # ⚠ borra clientes/reportes de la base LOCAL y carga datos de ejemplo
node manual/capture.mjs                     # toma las capturas con marcas numeradas (capturas/)
node manual/build.mjs                       # arma el PDF con portada, índice y páginas
```

- **Logo real de 311 Consultores:** guarda el archivo como `manual/assets/logo-311.png` (PNG con fondo transparente) y vuelve a correr `seed-demo.ts`, `capture.mjs` y `build.mjs`. Si no existe, `make-assets.mjs` crea uno de muestra.
- **Cambiar textos:** edita `contenido.mjs` y corre solo `build.mjs`.
- **Revisar el PDF sin abrirlo:** `node manual/preview.mjs` crea hojas de miniaturas en `salida/prev/`.
- `seed-demo.ts` se niega a correr si `DATABASE_URL` no es `localhost`.
- Si acabas de correr `npm run package:cpanel`, borra la carpeta `.next` antes de `npm run dev` (la compilación de producción deja archivos que confunden al servidor de desarrollo).
