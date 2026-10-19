# Despliegue en cPanel (Banahosting) — reportes.311consultores.com

Guía para publicar el sistema en un hosting compartido con cPanel. Docker no aplica aquí; se usa la
función **Setup Node.js App** de cPanel y una base **MySQL/MariaDB** (probado con MariaDB 10.6).

> Esta guía se preparó sin acceso a tu cPanel. El paquete se probó en Windows (arranca, lee la base y
> genera el PDF), pero **no se ha probado en el servidor de Banahosting**. Sigue primero el paso 0.

## 0. Verifica qué incluye tu plan (5 minutos)

En el panel de cPanel busca:

| Necesitas | Dónde se ve | Si no está |
|---|---|---|
| **Setup Node.js App** (Node 20 o superior) | sección *Software* | Pide a soporte que lo habiliten o pasa a un VPS (ver `DEPLOY.md`, que usa Docker) |
| **MySQL Databases** + *phpMyAdmin* | sección *Bases de datos* | Es lo habitual en cPanel; si faltara, pide a soporte que lo habiliten |
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

1. cPanel, *MySQL Databases*:
   - Crea la base (cPanel antepone tu usuario: `usuario_reportes`).
   - Crea un usuario con contraseña larga (sin espacios; evita `@ : / ? #` o codifícalos en la URL).
   - Asigna el usuario a la base con **todos los privilegios**.
2. Abre *phpMyAdmin*, selecciona la base, pestaña **Importar**, elige `database/schema.sql` y ejecuta (o pega su contenido en la pestaña **SQL**).
3. Crea el primer administrador. En tu computadora:

   ```bash
   node scripts/hash-password.mjs "tu-correo@311consultores.com" "Tu Nombre" "UnaContraseñaLarga123!"
   ```

   Copia el `INSERT` que imprime, pégalo en la pestaña SQL de phpMyAdmin (con la base seleccionada) y ejecútalo. Después podrás crear
   los demás usuarios desde la propia aplicación.

Tu `DATABASE_URL` queda así (host `localhost`, puerto 3306). `connection_limit` evita pasar el tope de conexiones del hosting compartido:

```
mysql://usuario_dbuser:CONTRASEÑA@localhost:3306/usuario_reportes?connection_limit=5
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

- **Diagnóstico rápido:** abre `https://reportes.311consultores.com/api/health`. Muestra si faltan variables y si
  la base de datos responde. Para ver el detalle del error agrega la variable `HEALTH_TOKEN` en la app y abre
  `/api/health?token=TU_VALOR` (bórrala cuando termines).
- **`Cannot find module '@prisma/client-<código>'`:** el paquete se compiló con Turbopack. `npm run package:cpanel`
  ya usa webpack (`--webpack`) y verifica que no queden enlaces simbólicos; vuelve a generar y subir el paquete.
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

1. `git pull`, luego `npm run package:cpanel`. Genera `dist-cpanel/app` (para subir) y `dist-cpanel/database/migraciones/`
   (una migración por archivo).
2. **Antes de subir el código**, si hubo cambios de base de datos, ejecuta en phpMyAdmin (pestaña **SQL**, con la base
   seleccionada) **solo** los archivos de `migraciones/` que aún no hayas aplicado, en orden de nombre. No repitas
   `schema.sql` completo. Haz un respaldo de la base antes (cPanel, *Backup*).
3. En el Administrador de archivos, borra el contenido de `reportes311/app` (**conserva** `reportes311-uploads/`), sube el
   `.tar.gz` del nuevo paquete y extráelo.
4. *Setup Node.js App*, **Restart**. Revisa `/api/health`.

### Evolutivo 1 (7 oct 2026)
- **Migración:** `20261007182221_evolutivo1.sql`. Agrega los consecutivos de folio, el título de actividad, la tabla de
  evidencias (hasta 3 por actividad; **conserva** la evidencia que ya tenía cada actividad), la recuperación de contraseña,
  la configuración y el modo oscuro por usuario.
- **Folios:** el formato nuevo es `PREFIJO + consecutivo + DDMMAA` (por ejemplo `LAJ001071026`). Los reportes anteriores
  conservan su folio; el consecutivo de cada cliente inicia en 001 con el primer reporte nuevo.
- **Después de actualizar:** entra como Administrador a **Configuración** y carga el logo de 311 Consultores; en
  **Clientes y proyectos** puedes agregar el logo de cada cliente con «Agregar logo».
- **Variable opcional `APP_URL`** (por ejemplo `https://reportes.311consultores.com`): fija la dirección que usan los enlaces
  de los correos. Si no la defines, se deduce de la petición.

### Evolutivo 3 (12 oct 2026) — registro público de clientes
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, pega y ejecuta
  `database/migraciones/20261012164939_evolutivo3.sql`. Agrega los datos fiscales y de contacto a `Client` y crea
  `ClientRegistration`.
- **Rutas nuevas:** `/registro` (formulario público, sin sesión) y `/registros` (revisión; Admin y Editor).
- **Enlace para clientes:** `https://reportes.311consultores.com/registro`. El Admin puede activarlo o desactivarlo en
  *Registro de clientes*.
- **Variable opcional `REGISTRO_NOTIFY_EMAIL`:** quién recibe el aviso de cada registro nuevo (por defecto
  `admon@311consultores.com`).
- La Constancia de Situación Fiscal solo la ven Admin y Editor. Al aprobar un registro se crea el cliente en el catálogo.

### Evolutivo 4 · Etapa 1 (16 oct 2026) — facturas y recibos
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, ejecuta
  `database/migraciones/20261016155034_evolutivo4a.sql`. Crea las tablas `Invoice` e `InvoiceLog`.
- **Variable nueva `CRON_TOKEN`** (Setup Node.js App › Environment variables): una clave larga inventada por ti
  (solo letras y números, 30 o más caracteres). Protege la ruta del aviso diario de facturas vencidas.
  Opcional: `FACTURAS_ALERT_EMAIL` (por defecto `admon@311consultores.com`).
- **Tarea programada (cPanel › Cron Jobs):** una vez al día, con este comando (cambia `TU_CRON_TOKEN`):
  `curl -s "https://reportes.311consultores.com/api/cron/facturas?token=TU_CRON_TOKEN" > /dev/null 2>&1`
  Revisa vencidas y manda UN correo a Administración con la lista (una vez por día, solo si hay vencidas).
  Para probarlo sin esperar, abre esa misma dirección en el navegador agregando `&force=1`.
- **Rutas nuevas:** `/facturas`, `/facturas/[id]`, `/facturas/datos-bancarios`, `/api/facturas/export` (Excel/CSV)
  y `/api/cron/facturas`.
- **Después de actualizar:** el Administrador captura los datos bancarios en *Facturas › Datos bancarios*
  (no van en el código ni en GitHub).

### Evolutivo 4 · Etapa 2 (16 oct 2026) — cajas, reparto y gastos (solo Administrador)
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, ejecuta
  `database/migraciones/20261016174317_evolutivo4b.sql`. Agrega la columna `distribution` a `Invoice` y crea las tablas
  `LedgerEntry`, `Expense` y `Movement`. No hay variables de entorno nuevas.
- **Menú nuevo «Finanzas»** (solo Admin): *Resumen* (cajas, utilidad individual, ingresos y egresos por mes), *Gastos*,
  *Movimientos* y *Porcentajes*. La exportación está en `/api/finanzas/export`.
- **Después de actualizar, en este orden:**
  1. *Finanzas › Porcentajes*: revisa los porcentajes (vienen de fábrica: nómina 45, ahorro 3, navidad 2, gastos 10,
     DEV 30, IVA 50/25/25 y 50 % de la utilidad para cada socio).
  2. *Finanzas › Movimientos › Saldo inicial*: captura lo que ya hay en cada caja (efectivo y banco).
  3. Si ya había facturas **Pagadas** de la Etapa 1, en *Porcentajes* aparece el botón «Repartir cobros anteriores»:
     úsalo UNA vez para que esos cobros también entren a las cajas.
- **Desde ahora**, cada factura o recibo que se marca como Pagada reparte su dinero en las cajas de forma automática.

### Evolutivo 5 · Etapa A (16 oct 2026) — menú, filtros y cards
- **Sin migración de base de datos y sin variables nuevas:** basta reemplazar la carpeta `app` y reiniciar.
- **Menú nuevo** agrupado: *Operación* (Reportes, Clientes y proyectos, Registro de clientes), *Administración*
  (Facturas, Finanzas) y, abajo, *Configuración* (General, Log —antes «Eliminaciones»— y Usuarios). En celular y tableta
  el menú se oculta tras un botón.
- **Reportes:** por defecto se ve el mes en curso (más los reportes abiertos de meses anteriores). El selector de periodo
  está a la derecha de los filtros de estatus.
- **Clientes y proyectos** pasa a cards, con ventanas emergentes para cada acción.
- **Login y pantallas públicas:** solo el logo y el subtítulo «Portal de Operaciones».

### Evolutivo 5 · Etapa B (16 oct 2026) — rol TEAM 311
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, ejecuta
  `database/migraciones/20261016201537_evolutivo5b.sql`. Agrega el rol TEAM_311, la foto y el cumpleaños de los usuarios,
  los proyectos asignados (`UserProject`), los consultores ligados a cada reporte y las solicitudes de edición (`EditRequest`).
- **Variable opcional `TEAM_NOTIFY_EMAILS`:** a quién se avisa cuando un TEAM 311 termina un reporte (separados por coma).
  Por defecto: `admon@311consultores.com,necesito@311consultores.com`.
- **Después de actualizar:** en *Configuración › Usuarios* (Admin o Editor) crea a cada TEAM 311 con su foto, cumpleaños y los
  proyectos que puede trabajar. Los proyectos nuevos NO se asignan solos.
- Las fotos se guardan en la carpeta de evidencias (`perfiles/`), así que entran en los respaldos de esa carpeta.

### Evolutivo 6 · Etapa 1 (19 oct 2026) — correos en pills, nombre y apellido, responsable de proyecto
- **Respaldo antes de actualizar (obligatorio):** cPanel › *Backup* (o phpMyAdmin › *Exportar* › *Rápido*) y descarga el `.sql`.
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, ejecuta
  `database/migraciones/20261019195715_evolutivo6a.sql`. Solo AGREGA columnas (apellidos de los contactos del cliente y del
  registro, y responsable del proyecto) y **conserva todos los datos**: los nombres ya guardados se separan solos
  (primera palabra = nombre, el resto = apellido). Se ejecuta una sola vez.
- Sin variables de entorno nuevas.
- Los correos del cliente y del proyecto se capturan como «pills»; el proyecto nuevo sugiere los correos principales del cliente.
- Después de actualizar, revisa en *Clientes y proyectos › Datos fiscales y de contacto* que los apellidos separados
  automáticamente estén bien (por ejemplo, un nombre como «Dra. Patricia Vega» queda «Dra.» + «Patricia Vega»): corrígelos con *Editar datos*.

### Evolutivo 6 · Etapa 2 (19 oct 2026) — usuarios, foto y actividades
- **Respaldo antes de actualizar (obligatorio):** exporta la base desde phpMyAdmin (o cPanel › *Backup*) y descarga el `.sql`.
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, ejecuta
  `database/migraciones/20261019201502_evolutivo6b.sql`. Solo agrega la columna `executedAt` a `ReportTask` (fecha y hora de
  ejecución de la actividad, opcional) y **conserva todos los datos**. Se ejecuta una sola vez. La Etapa 1 (`..._evolutivo6a.sql`)
  debe estar aplicada antes.
- Sin variables de entorno nuevas.
- **Eliminar usuario (solo Admin):** pide un motivo obligatorio y queda en *Log › Historial de eliminaciones*. Si el usuario ya tiene
  historial (reportes, facturas, movimientos) no se elimina: se ofrece desactivarlo.
- **Foto de perfil:** al elegirla se abre un recortador (arrastrar, zoom y vista en círculo).
- **Actividades:** el título se edita con el lápiz junto a «Actividad N»; la casilla «Indicar fecha y hora de ejecución» muestra
  la fecha y hora debajo del título (en pantalla y en el PDF).

### Evolutivo 6 · Etapa 3 (19 oct 2026) — fusión de clientes y cambio de cliente en un reporte
- **Sin migración de base de datos y sin variables nuevas:** basta reemplazar la carpeta `app` y reiniciar.
- **Respaldo antes de actualizar (obligatorio):** la fusión mueve proyectos, reportes y facturas de un cliente a otro y **no se puede deshacer**; conviene tener un respaldo reciente de la base.
- **Fusionar clientes** (Admin y Editor): en *Clientes y proyectos*, botón de la tarjeta «Fusionar con otro cliente». Se elige, dato por dato, cuál versión queda; los correos se pueden unir. Los folios ya emitidos NO cambian. Queda registrado en *Log › Fusiones de clientes*. Se bloquea si hay solicitudes de eliminación pendientes de esos clientes.
- **Duplicados en el registro público:** ahora el aviso aparece solo cuando coincide el RFC o algún correo (ya no el nombre).
- **Cambiar el cliente de un reporte** (Admin y Editor, cualquier estado): botón «Cambiar cliente» en el reporte. Regenera el folio con el prefijo del cliente nuevo y su siguiente consecutivo (conserva la fecha del folio) y guarda el folio anterior en el historial. Permite crear el proyecto en ese momento. Si el reporte ya se envió, pide escribir el folio actual para confirmar.

### Evolutivo 7 · Etapa 1 (19 oct 2026) — panel de tareas (Kanban)
- **Respaldo antes de actualizar (obligatorio):** exporta la base desde phpMyAdmin (o cPanel › *Backup*) y descarga el `.sql`.
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, ejecuta
  `database/migraciones/20261019230000_evolutivo7a.sql`. Solo CREA tablas nuevas (`Task`, `TaskAssignee`, `TaskResource`,
  `TaskEvent`) y **no toca ningún dato existente**. Se ejecuta una sola vez.
- Sin variables nuevas. Los avisos de «tarea lista para revisar» usan `TEAM_NOTIFY_EMAILS` (por defecto admon@ y necesito@).
- **Menú:** nueva opción **Tareas** en *Operación* (Admin, Editor y TEAM 311). El TEAM 311 aterriza en Tareas al iniciar sesión.
- Admin y Editor crean, editan y eliminan tareas (la eliminación del Editor la aprueba el Admin desde el Log); el TEAM 311 mueve sus tareas
  Pendiente ↔ En proceso → Para revisar con arrastrar o con el botón «Lista». Solo Admin y Editor aceptan (Terminada).
- Las terminadas se ocultan solas a los 15 días; «Limpiar terminadas» las oculta de inmediato y quedan en *Historial*.

### Evolutivo 7 · Etapa 2 (20 oct 2026) — chat de la tarea y centro de avisos
- **Respaldo antes de actualizar (obligatorio):** exporta la base desde phpMyAdmin (o cPanel › *Backup*) y descarga el `.sql`.
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, ejecuta
  `database/migraciones/20261020000000_evolutivo7b.sql`. Solo CREA tablas nuevas (`TaskMessage`, `TaskAttachment`, `Notification`)
  y **no toca ningún dato existente**. La Etapa 1 (`..._evolutivo7a.sql`) debe estar aplicada antes.
- **Variable opcional `GIPHY_API_KEY`** (Setup Node.js App › Environment variables): activa la búsqueda de GIF en el chat. Sin ella el chat
  funciona igual y el botón GIF explica que no está activado. Se obtiene gratis en https://developers.giphy.com (crear app tipo *API*).
- **Chat:** conversación entre Admin/Editor y el TEAM 311 asignado, con formato, emojis, GIF y adjuntos (imágenes, videos MP4/WEBM/MOV,
  PDF, Word, Excel, PowerPoint, TXT y CSV; PDF y documentos hasta 15 MB, videos hasta 100 MB). Los mensajes no se editan ni se borran.
  Los adjuntos se guardan en la carpeta de archivos del portal (`tareas/`), así que entran en los respaldos de esa carpeta.
- **Avisos:** campanita con globo rojo junto al botón de modo oscuro. Avisa: tarea asignada, lista para revisar, devuelta, aceptada y mensajes
  nuevos. Cada mensaje del chat también manda un correo (agrupado: como máximo uno cada 5 minutos por persona y tarea).

### Evolutivo 7 · Etapa 3 (20 oct 2026) — sorpresa, racha, recordatorios y calendario
- **Respaldo antes de actualizar (obligatorio):** exporta la base desde phpMyAdmin (o cPanel › *Backup*) y descarga el `.sql`.
- **Migración (antes de reemplazar la app):** en phpMyAdmin, pestaña *SQL*, ejecuta
  `database/migraciones/20261020120000_evolutivo7c.sql`. Solo agrega la columna `reminderSentAt` (opcional) a `Task` y **no toca ningún dato**.
  Las migraciones 7a y 7b deben estar aplicadas antes.
- **Tarea programada nueva (cPanel › Cron Jobs):** ejecútala **cada hora** (Minuto `0`, Hora `*`, Día `*`, Mes `*`, Día de la semana `*`), con este
  comando (cambia `TU_CRON_TOKEN` por el mismo valor de la variable `CRON_TOKEN` que ya usas para facturas):
  `curl -s "https://reportes.311consultores.com/api/cron/tareas?token=TU_CRON_TOKEN" > /dev/null 2>&1`
  Cada hora manda el recordatorio de «vence en menos de 12 horas» (una sola vez por tarea) y, **una vez al día después de las 8:00 (hora de México)**,
  el aviso de tareas vencidas: correo a cada persona con sus tareas y un resumen a Administración (`TEAM_NOTIFY_EMAILS`). Para probarlo,
  abre esa misma dirección en el navegador agregando `&force=1`.
- **Sorpresa de felicitación:** al aceptar una tarea, Admin/Editor dejan marcada la casilla «🎁 Habilitar la sorpresa». El TEAM 311 ve la tarjeta en
  TERMINADA con un aviso para dar clic y descubrir la sorpresa (confeti, frase alegre y el comentario de quien la aceptó).
- **Racha mensual** (solo el TEAM 311): «Llevas N tareas aceptadas este mes» con insignias ⭐ (5) y 🏆 (10).
- **Calendario:** botón *Tablero / Calendario* (se recuerda la vista elegida). Mes completo; Admin y Editor pueden arrastrar una tarea a otro día para cambiar su fecha de entrega.
- El mini-panel de cada tarea ahora tiene un catálogo de 500 frases de humor de oficina.

## 10. Respaldos

- Base de datos: cPanel, *Backup*, o un *Cron Job* con `mysqldump`. Descarga una copia fuera del hosting con frecuencia.
- Evidencias: incluye `reportes311-uploads/` en los respaldos de cPanel, o usa S3/Spaces con versionado.

## 11. Consumo de recursos (hosting compartido)

En CloudLinux los **hilos cuentan como procesos** del plan. El paquete ya limita lo que más consumía (a partir del Evolutivo 2):

- Al arrancar, `server.js` fija `UV_THREADPOOL_SIZE=2`, `TOKIO_WORKER_THREADS=2` (el motor de Prisma crea un hilo por núcleo del
  servidor si no se limita) y un tope de memoria de 512 MB (`NODE_MAX_HEAP_MB` lo cambia). Si defines esas variables en
  *Setup Node.js App*, se respetan las tuyas.
- Una sola instancia de Prisma por proceso, PDF de uno en uno con caché, archivos enviados por partes y menos escrituras al autoguardar.

- Las evidencias se suben como cuerpo directo y se guardan en disco por partes (hasta 100 MB sin cargarlas en memoria). La ruta de
  subida queda fuera del `proxy`, que en Next.js limita a 10 MB el cuerpo de las peticiones que pasan por él.
- Al arrancar, el proceso escribe en el log una línea `[proceso] inicio pid=… ppid=… nucleos=…`. Si ves muchas líneas seguidas, el
  proceso se está reiniciando; el número de núcleos indica cuántos hilos habría creado el motor de Prisma sin límite.

**Cómo revisar el consumo.** Abre `https://reportes.311consultores.com/api/health?token=TU_HEALTH_TOKEN` (agrega temporalmente
la variable `HEALTH_TOKEN`). El bloque `recursos` muestra `hilos`, `rssMB` (memoria), `descriptoresAbiertos`, `instanciasPrisma`
(debe ser 1) y los contadores de PDF. Si `hilos` supera ~30 o `rssMB` crece sin parar entre revisiones, avísame.

**Qué pedir a soporte si el servidor vuelve a caerse:** el detalle de los límites de tu plan (procesos/NPROC, procesos de entrada,
memoria y CPU) y la lista de procesos `node` de tu usuario en el momento del problema. En cPanel, *Resource Usage* muestra las
gráficas y los eventos en que se alcanzó cada límite.

## Notas de seguridad

- El límite de intentos de login es por proceso; Passenger puede levantar varios, así que el límite real es más laxo.
- Nunca subas el `.env` ni lo guardes dentro de `public_html`.
- Cambia la contraseña del administrador si la compartiste durante la instalación.
