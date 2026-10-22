# Cambiar la dirección del portal a otro subdominio (guía para evaluar)

Ejemplo: de `reportes.311consultores.com` a `proyectos.311consultores.com`. Sustituye el nombre nuevo por el que elijas.
**El código no necesita cambios**: los enlaces se arman con la variable `APP_URL` (o con la dirección con que se abre el portal). Todo es configuración en cPanel.

## Qué pasa con cada cosa
| Elemento | Efecto del cambio | Qué hacer |
|---|---|---|
| Datos (clientes, reportes, tareas, usuarios) | Ninguno: están en la misma base de datos | Nada |
| Sesión iniciada | Se cierra (la sesión es del dominio anterior) | Volver a iniciar sesión |
| App instalada en celulares (PWA) | Queda ligada a la dirección vieja | Desinstalarla e instalarla de nuevo desde la dirección nueva |
| Notificaciones del navegador | Se pierden al cambiar de dirección | Entrar a *App y avisos* y presionar **Activar notificaciones** otra vez |
| Enlaces ya enviados (correos, WhatsApp) | Dejan de abrir si no hay redirección | Dejar una **redirección** del dominio viejo al nuevo (paso 6) |
| Tarea programada (cron) | Apunta a la dirección vieja | Cambiar la dirección en el *Cron Job* (paso 7) |
| Enlace de registro de clientes | Cambia | Avisar la dirección nueva `https://NUEVO/registro` |
| Claves de Gmail, Giphy, VAPID | Sin cambios | Nada |

## Pasos (hacer en horario tranquilo; el portal estará unos minutos sin servicio)
1. **Respaldo:** cPanel › *Backup* (o phpMyAdmin › Exportar). Guarda el `.sql`.
2. **Crear el subdominio nuevo:** cPanel › *Dominios* (o *Subdominios*) › **Crear un dominio** › escribe `proyectos.311consultores.com`. Si pide carpeta raíz, deja la sugerida. Espera a que cPanel genere el certificado SSL (candado); puede tardar unos minutos (*SSL/TLS Status* › **Run AutoSSL**).
3. **Mover la aplicación:** cPanel › *Setup Node.js App* › entra a la aplicación › en **Application URL** elige el dominio **nuevo** › **Save**.
4. **Actualizar la variable:** en la misma pantalla, en *Environment variables*, edita `APP_URL` (si no existe, créala) con `https://proyectos.311consultores.com` › **Save** › **Restart**.
5. **Probar:** abre `https://proyectos.311consultores.com/api/health` (debe responder). Entra al portal, inicia sesión, abre una tarea y revisa que el botón **Copiar enlace** genere la dirección nueva.
6. **Redirección del dominio viejo:** cPanel › *Redirecciones* › Tipo **Permanente (301)** › dominio `reportes.311consultores.com` › redirige a `https://proyectos.311consultores.com/` › marca **Redirigir con o sin www** y **Redirección comodín** (así `…/tareas?tarea=…` sigue funcionando) › **Agregar**. Mantenla al menos 3 meses.
7. **Cron Job:** cPanel › *Cron Jobs* › edita los dos comandos (`/api/cron/tareas` y `/api/cron/facturas`) cambiando `reportes.311consultores.com` por el dominio nuevo.
8. **Avisar al equipo:** reinstalar la app en el celular, volver a activar notificaciones y usar la dirección nueva.

## Si algo sale mal
Regresa **Application URL** al dominio viejo y `APP_URL` a su valor anterior, y presiona **Restart**. No se pierde ningún dato.

## Después del cambio (lo hace el desarrollador)
Actualizar las direcciones escritas en `CPANEL.md` y en los manuales PDF.
