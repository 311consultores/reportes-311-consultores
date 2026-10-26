# Conectar el portal con Meta (Campañas Meta) — guía clic por clic

> Las pantallas de Meta cambian de nombre y de lugar con frecuencia. Si algún botón no está exactamente como aquí se describe, busca el más parecido o pide ayuda.
> **Nunca pegues el token ni las claves en un chat ni en un correo.** Solo van en las variables del servidor (cPanel).

## Qué se necesita
1. Una **app de Meta** (en developers.facebook.com) ligada al Business Manager verificado de 311 Consultores.
2. Un **usuario del sistema** en el Business Manager, con las cuentas publicitarias (y las Páginas de Facebook) de los clientes asignadas.
3. Un **token** de ese usuario del sistema que no caduque.
4. Una **clave de la API de Claude (Anthropic)** para la guía de IA.

## Parte 1 — Crear la app de Meta
1. Entra a **https://developers.facebook.com** con la cuenta que administra el Business Manager (`necesito@311consultores.com`).
2. Arriba a la derecha, **Mis apps** → **Crear app**.
3. Si te pide un caso de uso, elige **Otro** (o «Administrar anuncios / API de Marketing» si aparece) y luego el tipo **Empresa (Business)**.
4. Nombre de la app: `Portal 311 Consultores`. Correo de contacto: el de la empresa. En **Portafolio comercial / Business Manager** elige el de 311 Consultores (el verificado). **Crear app**.
5. En el panel de la app, busca **Agregar productos** (o «Casos de uso») y agrega **API de Marketing (Marketing API)**.
6. Menú **Configuración de la app › Básica**: anota el **ID de la app** (no es secreto). Más adelante Meta puede pedir ahí la **URL de la política de privacidad** y un **ícono**; si te lo pide, avísame y los preparo.

## Parte 2 — Crear el usuario del sistema y darle acceso a los clientes
1. Entra a **https://business.facebook.com/settings** (Configuración del negocio) con el Business Manager de 311.
2. Menú izquierdo: **Usuarios › Usuarios del sistema** → **Agregar**.
3. Nombre: `Portal 311`. Rol: **Administrador** (recomendado para poder asignarle activos) → **Crear usuario del sistema**.
4. Con el usuario `Portal 311` seleccionado, pulsa **Agregar activos**:
   - **Cuentas publicitarias**: marca las de los clientes (las 10 a 12) y activa **Control total (Administrar cuenta publicitaria)**.
   - **Páginas**: marca las Páginas de Facebook de esos clientes con **Control total** (hacen falta para crear y modificar anuncios).
   - **Apps**: marca `Portal 311 Consultores` con **Control total**.
   - Guarda con **Guardar cambios**.
5. Si una cuenta publicitaria de un cliente **no** aparece en la lista, es porque aún no la comparte con 311: el cliente debe darte acceso como socio (Configuración del negocio del cliente › Socios) o agregar la cuenta a tu Business Manager.

## Parte 3 — Generar el token
1. En **Usuarios del sistema**, selecciona `Portal 311` y pulsa **Generar token**.
2. Elige la app `Portal 311 Consultores`.
3. **Caducidad del token: Nunca** (si no aparece esta opción, elige la más larga).
4. Marca estos permisos: `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`.
5. Pulsa **Generar token** y **cópialo** (solo se muestra una vez). Guárdalo en tu administrador de contraseñas.

## Parte 4 — Clave del asistente de IA
1. Entra a **https://console.anthropic.com**, inicia sesión (o crea la cuenta de la empresa) y agrega un método de pago / crédito.
2. **API Keys** (Claves de API) → **Create Key** → nombre `Portal 311` → copia la clave (empieza con `sk-ant-`).
3. El consumo es por uso; las consultas del portal son cortas, por lo que el costo mensual es bajo. Puedes fijar un límite de gasto mensual en la misma consola.

## Parte 5 — Poner las claves en el servidor (cPanel)
1. cPanel › **Setup Node.js App** › entra a la aplicación.
2. En **Environment variables** agrega:

| Variable | Valor |
|---|---|
| `META_ACCESS_TOKEN` | el token de la Parte 3 |
| `ANTHROPIC_API_KEY` | la clave de la Parte 4 |
| `META_API_VERSION` | (opcional) por ejemplo `v23.0`; si no la pones, el portal usa la versión incluida |
| `ANTHROPIC_MODEL` | (opcional) modelo del asistente; si no la pones, usa el recomendado |

3. **Save** y luego **Restart**.
4. Entra al portal como Administrador › **Campañas Meta › Conexión y accesos**. Debe aparecer ✅ «Conectado como …» y ✅ «Guía de IA configurada».
5. Pulsa **Importar cuentas de Meta**. Para cada cuenta: elige el **cliente del portal**, marca quiénes (EDITOR o PROJECT 311) la pueden ver y **Guardar**. El ADMINISTRADOR ve todas.

## Revisión de la app de Meta (puede hacer falta)
Para trabajar con cuentas de clientes reales, Meta puede pedir **Acceso avanzado** a `ads_management` y `ads_read` mediante la **Revisión de la app (App Review)**: se envía un video corto que muestra para qué se usa el permiso. Cuando llegue ese momento, yo preparo el guion y la descripción. Mientras tanto, el portal funciona con las cuentas a las que el usuario del sistema ya tiene acceso.

## Si algo falla
- «El acceso a Meta venció o fue revocado»: genera un token nuevo (Parte 3) y cámbialo en cPanel.
- «Meta no permite esta acción…»: revisa que la cuenta publicitaria esté asignada al usuario del sistema con control total.
- No aparecen cuentas al importar: revisa la Parte 2, paso 4.
