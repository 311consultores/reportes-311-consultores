# Despliegue — proyectos.311consultores.com

> Si tu hosting es **cPanel** (Banahosting), usa [CPANEL.md](CPANEL.md). Esta guía es para un VPS con Docker.

## Requisitos
- Servidor Linux con Docker y Docker Compose.
- Un proxy inverso con HTTPS (Caddy, Nginx o el balanceador del proveedor) apuntando al puerto 3000.
  La cookie de sesión es `secure` en producción, así que **HTTPS es obligatorio**.
- Bucket S3 / DigitalOcean Spaces para las evidencias (en producción no uses `.uploads`, que no es persistente).
- Credenciales OAuth2 de Gmail (Google Workspace) con permiso `gmail.send`.

## Pasos
1. Copia `.env.example` a `.env` y completa:
   - `DB_ROOT_PASSWORD` y `DB_PASSWORD` (contraseñas de MariaDB; `DATABASE_URL` la arma docker-compose)
   - `AUTH_SECRET` (aleatorio, 32+ caracteres: `openssl rand -hex 32`)
   - `S3_*` y `GMAIL_*`
   - `MAIL_DRY_RUN="false"` (o elimínalo; además se ignora cuando `NODE_ENV=production`)
2. Construye y levanta: `docker compose up -d --build`
   (el servicio `migrate` aplica las migraciones antes de iniciar la app).
3. Crea el primer administrador una sola vez:
   `docker compose run --rm -e SEED_ADMIN_PASSWORD=... migrate npx prisma db seed`
4. Respaldos: programa `mysqldump` del volumen `dbdata` y activa versionado en el bucket.

## Notas
- El límite de intentos de login está en memoria: válido para una sola instancia de la app.
- Las imágenes `Dockerfile`/`docker-compose.yml` no se han probado en este equipo (sin Docker instalado); revisa el primer build.
