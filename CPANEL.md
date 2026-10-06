# Despliegue en cPanel (Banahosting) — reportes.311consultores.com

Guía para publicar el sistema en un hosting compartido con cPanel. Docker no aplica aquí; se usa la
función **Setup Node.js App** de cPanel y una base **PostgreSQL**.

> Esta guía se preparó sin acceso a tu cPanel. El paquete se probó en Windows (arranca, lee la base y
> genera el PDF), pero **no se ha probado en el servidor de Banahosting**. Sigue primero el paso 0.

## 0. Verifica qué incluye tu plan (5 minutos)

En el panel de cPanel busca:

| Necesitas | Dónde se ve | Si no está |
|---|---|---|
| **Setup Node.js App** (Node 20 o superior) | sección *Software* | Pide a soporte que lo habiliten o pasa a un VPS (ver `DEPLOY.md`, que usa Docker) |
| **PostgreSQL Databases** + *phpPgAdmin* | sección *Bases de datos* | Usa una base externa gratuita (Neon o Supabase) y pon su `DATABASE_URL`; el resto no cambia |
| **SSL/TLS Status** (AutoSSL) | sección *Seguridad* | Imprescindible: la sesión usa cookie `secure`, sin HTTPS no se puede iniciar sesión |
| **Terminal** o SSH (opcional) | *Avanzado* | No es obligatorio, todo se puede hacer con el Administrador de archivos |

Además averigua con soporte: versión de Node disponible, límite de memoria (LVE) y tamaño máximo de
subida de peticiones (las evidencias en video pueden pesar hasta 100 MB).

## 1. Generar el paquete (en tu computadora)

```bash
npm run package:cpanel
```

Crea la carpeta `dist-cpanel/` con:
- `app/` — la aplicación compilada (incluye `node_modules` mínimos y los motores de Prisma para RHEL/CloudLinux).
- `database/schema.sql` — estructura de la base de datos.

Comprime `dist-cpanel/app` en un `.zip` (clic derecho, *Comprimir en archivo ZIP*). El `.env` local **no** viaja en el paquete.

## 2. Subdominio y HTTPS

1. cPanel, *Dominios* (o *Subdominios*): crea `reportes.311consultores.com`. Si ya existe, déjalo apuntando
   a una carpeta cualquiera; la app de Node tomará el control del dominio en el paso 5.
2. cPanel, *SSL/TLS Status*: ejecuta **Run AutoSSL** y confirma que el subdominio tenga candado.

## 3. Base de datos

1. cPanel, *PostgreSQL Databases*:
   - Crea la base (cPanel antepone tu usuario: `usuario_reportes`).
   - Crea un usuario con contraseña larga (sin espacios; evita `@ : / ? #` o codifícalos en la URL).
   - Asigna el usuario a la base con **todos los privilegios**.
2. Abre *phpPgAdmin*, entra a la base, pestaña **SQL**, pega el contenido de `database/schema.sql` y ejecuta.
3. Crea el primer administrador. En tu computadora:

   ```bash
   node scripts/hash-password.mjs "tu-correo@311consultores.com" "Tu Nombre" "UnaContraseñaLarga123!"
   ```

   Copia el `INSERT` que imprime, pégalo en la pestaña SQL de phpPgAdmin y ejecútalo. Después podrás crear
   los demás usuarios desde la propia aplicación.

Tu `DATABASE_URL` queda así (host `localhost`, puerto 5432):

```
postgresql://usuario_dbuser:CONTRASEÑA@localhost:5432/usuario_reportes?schema=public
```

## 4. Subir los archivos

1. *Administrador de archivos*: crea la carpeta `reportes311` **fuera de `public_html`** (en tu directorio home).
2. Sube el `.zip` a `reportes311/` y extráelo para que quede `reportes311/app/server.js`.
3. Crea también `reportes311-uploads/` (en el home) para las evidencias, si no vas a usar S3.

## 5. Crear la aplicación Node.js

cPanel, *Setup Node.js App*, **Create Application**:

| Campo | Valor |
|---|---|
| Node.js version | la más alta disponible (mínimo 20) |
| Application mode | Production |
| Application root | `reportes311/app` |
| Application URL | `reportes.311consultores.com` |
| Application startup file | `server.js` |

> No pulses *Run NPM Install*: el paquete ya trae todo. Si cPanel reemplaza la carpeta `node_modules`
> por un enlace simbólico, elimina ese enlace y vuelve a subir la carpeta `node_modules` del `.zip`.

En **Environment variables** agrega (botón *Add variable*):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | la URL del paso 3 |
| `AUTH_SECRET` | texto aleatorio de 32+ caracteres (genera uno con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `UPLOADS_DIR` | `/home/TU_USUARIO/reportes311-uploads` |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER` | ver paso 6 |

No definas `MAIL_DRY_RUN` en producción. Si prefieres S3 / Spaces, define `S3_ENDPOINT`, `S3_REGION`,
`S3_BUCKET`, `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY` y omite `UPLOADS_DIR`.

Pulsa **Save** y luego **Restart**. Abre https://reportes.311consultores.com e inicia sesión.

## 6. Gmail (envío de reportes)

1. En https://console.cloud.google.com crea un proyecto (con la cuenta de Google Workspace de 311).
2. *APIs y servicios, Biblioteca*: habilita **Gmail API**.
3. *Pantalla de consentimiento OAuth*: tipo **Interno** (Workspace), nombre de la app, correo de soporte.
4. *Credenciales, Crear credenciales, ID de cliente OAuth*: tipo **Aplicación de escritorio**. Copia el
   Client ID y el Client secret.
5. En tu computadora, en el .env define GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET y GMAIL_SENDER
   (la cuenta que enviará), y ejecuta `npm run gmail:token`. Abre la URL que imprime, autoriza con esa
   cuenta, y el script guarda GMAIL_REFRESH_TOKEN en tu .env sin mostrarlo.
6. Prueba el envío: `npm run gmail:test -- tu-correo@dominio.com`.
7. Copia las cuatro variables GMAIL_* del .env a *Environment variables* del paso 5 y reinicia la app.
8. Prueba en producción: aprueba un reporte de prueba y usa **Enviar por correo** hacia una dirección tuya.

> Si la pantalla de consentimiento no es **Interna**, Google caduca el refresh token a los 7 días. Con
> Workspace y tipo Interno no caduca (salvo que se revoque o se cambie la contraseña de la cuenta).
## 7. Lista de verificación después de publicar

- [ ] https://reportes.311consultores.com carga con candado y redirige a `/login`.
- [ ] Inicias sesión con el administrador del paso 3.
- [ ] Creas un cliente con proyecto y un reporte; el folio se genera (`311XXX001`).
- [ ] Escribes en una actividad y aparece «Guardado»; recargas y el texto sigue.
- [ ] Subes una imagen como evidencia y se ve.
- [ ] «Ver PDF» muestra el reporte con la imagen.
- [ ] Apruebas y envías por correo a tu propia dirección; llega con el PDF adjunto.

## 8. Si algo falla

- **Página de error de Passenger / 503:** revisa el log de la app. Está en `reportes311/app/stderr.log`
  o en el enlace *Open log* de *Setup Node.js App*.
- **`Query engine library ... not found` / error de Prisma:** el servidor usa otra versión de OpenSSL. Ejecuta
  `openssl version` en Terminal y avísame (añadimos ese motor en `prisma/schema.prisma`).
- **`AUTH_SECRET no está definido`:** falta la variable de entorno; guarda y reinicia.
- **No puedes iniciar sesión pero la contraseña es correcta:** casi siempre es falta de HTTPS (cookie `secure`).
- **Falla al subir videos grandes:** el servidor corta peticiones grandes. Pide a soporte subir el límite,
  o usa S3/Spaces y mantén los videos pequeños.
- **Error de memoria al generar PDF:** el límite (LVE) del plan es bajo; pide a soporte aumentarlo.

## 9. Actualizar la aplicación

1. `git pull`, luego `npm run package:cpanel` y sube el nuevo `app/` (reemplaza archivos; **conserva** `reportes311-uploads/`).
2. Si hubo cambios de base de datos, ejecuta en phpPgAdmin **solo** las migraciones nuevas
   (`prisma/migrations/<fecha>_<nombre>/migration.sql`). No repitas `schema.sql` completo.
3. *Setup Node.js App*, **Restart**.

## 10. Respaldos

- Base de datos: cPanel, *Backup*, o un *Cron Job* con `pg_dump`. Descarga una copia fuera del hosting con frecuencia.
- Evidencias: incluye `reportes311-uploads/` en los respaldos de cPanel, o usa S3/Spaces con versionado.

## Notas de seguridad

- El límite de intentos de login es por proceso; Passenger puede levantar varios, así que el límite real es más laxo.
- Nunca subas el `.env` ni lo guardes dentro de `public_html`.
- Cambia la contraseña del administrador si la compartiste durante la instalación.
