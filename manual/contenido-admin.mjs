// Contenido del manual del ADMINISTRADOR (funciones exclusivas del rol). Mismos bloques que contenido.mjs.
export const URL_SISTEMA = "https://reportes.311consultores.com";

export const secciones = [
  {
    id: "antes",
    titulo: "Antes de empezar",
    bloques: [
      { t: "p", x: "Este manual explica, paso a paso y con imágenes, lo que <b>solo el perfil ADMINISTRADOR</b> puede hacer en el <b>Portal de Operaciones de 311 Consultores</b>: medir el desempeño del equipo, administrar las áreas, los usuarios y sus roles, y autorizar las solicitudes del equipo." },
      { t: "note", k: "info", x: "Las tareas, los reportes, las facturas y el Baúl se usan igual que en el <b>Manual del Editor</b>. Aquí solo se explica lo propio del ADMINISTRADOR." },
      { t: "h3", x: "Qué puede hacer el ADMINISTRADOR" },
      { t: "bullets", x: [
        "Ver el <b>dashboard de Desempeño</b>: puntualidad, devoluciones, tiempos, carga, comparativos por persona, área, cliente y proyecto, y exportarlo a Excel.",
        "Crear y administrar las <b>áreas</b> del equipo (DISEÑO, CRM, CONSULTORÍA…).",
        "Crear usuarios, <b>cambiarles el rol</b>, asignarles áreas, desactivarlos o eliminarlos.",
        "Autorizar o rechazar las <b>solicitudes</b> del equipo (editar reportes terminados, eliminar tareas, reportes y otros elementos) desde el <b>Log</b>.",
        "Ver las <b>Finanzas</b> (cajas, gastos y <b>préstamos</b>) y revertir pagos, y cambiar el <b>logo</b> de 311 Consultores.",
      ] },
      { t: "h3", x: "Los roles del portal" },
      { t: "table", head: ["Rol", "Qué hace"], rows: [
        ["ADMINISTRADOR", "Todo lo anterior. Es el único que ve el Desempeño, las Finanzas y el Log."],
        ["EDITOR", "Gestiona reportes, clientes, facturas y tareas; crea y edita usuarios CLIENTE, TEAM 311 y PROJECT 311 (sin cambiar roles ni eliminar)."],
        ["PROJECT 311", "Gestiona todas las tareas (crea, asigna, edita, acepta); no ve reportes ni facturas. También se le mide su entrega."],
        ["TEAM 311", "Recibe y trabaja tareas, y captura reportes de los proyectos que se le asignan."],
        ["CLIENTE", "Solo consulta los reportes enviados a su empresa y sus facturas."],
      ] },
    ],
  },
  {
    id: "menu",
    titulo: "Tu menú",
    bloques: [
      { t: "fig", f: "admin/a01-menu", c: "Menú del ADMINISTRADOR (grupos Administración y Configuración desplegados)", max: 27, l: [
        "<b>Facturas</b>: facturas y recibos que se envían a cobrar.",
        "<b>Finanzas</b>: ingresos, egresos, cajas y préstamos (solo ADMINISTRADOR).",
        "<b>Desempeño</b>: el dashboard de métricas del equipo (solo ADMINISTRADOR).",
        "<b>General</b>: logo de la empresa y catálogo de áreas.",
        "<b>Log</b>: solicitudes por autorizar y bitácora de movimientos. El globito rojo indica cuántas hay pendientes.",
        "<b>Usuarios</b>: altas, roles, áreas y cuentas.",
        "<b>App y avisos</b>: instalar la app y activar las notificaciones.",
      ] },
    ],
  },
  {
    id: "desempeno",
    titulo: "El dashboard de Desempeño",
    bloques: [
      { t: "p", x: "Abre <b>Administración › Desempeño</b>. El dashboard mide al equipo con los datos que el portal ya guarda (cuándo se crea, se entrega, se devuelve y se acepta cada tarea). Solo mide <b>desde la fecha en que se activó</b>; nada anterior cuenta." },
      { t: "h3", x: "Filtros" },
      { t: "fig", f: "admin/a02-resumen", c: "Filtros y resumen del equipo", l: [
        "<b>Filtros</b>: todo el dashboard se recalcula con ellos al presionar <b>Aplicar</b> (<b>Limpiar</b> los quita).",
        "<b>Periodo</b>: últimos 7 o 30 días, este mes, mes anterior o un rango personalizado (aparecen Desde y Hasta).",
        "<b>Persona</b>: mide solo a una persona.",
        "<b>Área</b>: mide solo las tareas de esa área (o las que están «Sin área»). También puedes filtrar por <b>Cliente</b>.",
        "<b>Puntualidad proporcional</b>: la métrica principal. El punto de color es el semáforo.",
        "<b>Abiertas ahora</b>: tareas sin terminar, cuántas están vencidas y cuántas vencen en menos de 12 horas.",
      ] },
      { t: "h3", x: "Cómo se calcula la puntualidad" },
      { t: "p", x: "Una tarea entregada <b>a tiempo</b> (el momento en que se marca «Lista») vale <b>100 %</b>. Si se entrega tarde, el retraso se compara contra el <b>tiempo que se tenía</b> (desde que se asignó hasta la fecha límite): <b>100 % − (retraso ÷ tiempo que se tenía)</b>, con mínimo 0 %. Así, 6 horas de retraso pesan poco en una tarea de 2 días y mucho en una de 2 horas." },
      { t: "table", head: ["Tarea", "Tenía", "Entregó", "Calificación"], rows: [
        ["A", "48 h", "2 h antes", "<b>100 %</b>"],
        ["B", "48 h", "6 h tarde", "<b>87.5 %</b> (6 ÷ 48 = 12.5 % de retraso)"],
        ["C", "2 h", "1 h tarde", "<b>50 %</b>"],
        ["D", "10 días", "24 h tarde", "<b>90 %</b>"],
        ["E", "24 h", "30 h tarde", "<b>0 %</b> (el retraso supera el plazo)"],
      ] },
      { t: "p", x: "La puntualidad de una persona es el promedio de sus tareas del periodo, y <b>siempre</b> aparece junto al conteo «X de Y a tiempo». Si el plazo se modifica, se usa la fecha límite final." },
      { t: "note", k: "info", x: "<b>Semáforo.</b> Verde desde 90 %, ámbar de 75 % a 89 % y rojo por debajo de 75 %. Los umbrales se pueden cambiar (sección «Configurar y exportar»)." },
      { t: "note", k: "warn", x: "Ninguna cifra va sola. Una buena puntualidad con muchas devoluciones es un riesgo, y una persona con pocas tareas puede verse mal por un solo caso: mira siempre el número de tareas que hay detrás." },
      { t: "h3", x: "Qué significa cada métrica" },
      { t: "table", head: ["Métrica", "Qué mide"], rows: [
        ["Retraso promedio", "Horas de atraso en las tareas que llegaron tarde."],
        ["Devoluciones", "Veces que una tarea volvió de «Para revisar» a «En proceso», entre las entregas del periodo. Mide la calidad de lo que se entrega."],
        ["Tiempo de ciclo", "Desde que se crea la tarea hasta que se acepta."],
        ["Tiempo de respuesta", "Desde que se asigna hasta que la persona la pasa a «En proceso»."],
        ["Subtareas completadas", "Porcentaje de subtareas cerradas al entregar la tarea."],
        ["Carga actual", "Tareas abiertas, vencidas y por vencer (12 h) de cada persona."],
        ["Aceptadas este mes", "Racha mensual de tareas aceptadas."],
      ] },
    ],
  },
  {
    id: "embudo",
    titulo: "Embudo, tendencia y comparativos",
    bloques: [
      { t: "fig", f: "admin/a03-embudo-tendencia", c: "Embudo de tareas y tendencia", l: [
        "<b>Embudo</b>: cuántas tareas hay en cada fase y cuánto llevan ahí en promedio. Si una fase acumula tareas y mucho tiempo, ahí se está atorando el trabajo.",
        "<b>Por semana / Por mes</b>: cambia la agrupación de la tendencia.",
        "<b>Tendencia</b>: las barras son tareas entregadas; la línea es la puntualidad. Las franjas de color son el semáforo y el color de cada punto indica en cuál cayó.",
      ] },
      { t: "p", x: "Más abajo hay tablas <b>por área</b>, <b>por cliente</b> y <b>por proyecto</b> (con entregadas, puntualidad, devoluciones, ciclo y abiertas/vencidas), y la <b>distribución de la carga</b>: las tareas abiertas de cada persona, útil para reasignar trabajo." },
      { t: "note", k: "tip", x: "Cada tarea cuenta en el área que se eligió al crearla. Las anteriores a la actualización aparecen como «Sin área»." },
    ],
  },
  {
    id: "personas",
    titulo: "Por persona y fichas individuales",
    bloques: [
      { t: "fig", f: "admin/a04-personas", c: "Tabla por persona", l: [
        "El nombre abre la <b>ficha individual</b> de esa persona.",
        "<b>Puntualidad</b> con el semáforo y el conteo «X de Y a tiempo».",
        "Una persona sin tareas entregadas en el periodo aparece con «—»: no se califica sin datos.",
        "<b>Devoluciones</b> con el número entre paréntesis.",
      ] },
      { t: "p", x: "No hay <b>ranking</b>: el portal no ordena a las personas de mejor a peor. Cada una se compara contra la <b>meta del equipo</b> y contra <b>su propio periodo anterior</b>." },
      { t: "h3", x: "La ficha individual" },
      { t: "fig", f: "admin/a07-ficha", c: "Ficha individual", max: 82, l: [
        "Nombre, rol y áreas de la persona. «Volver al dashboard» conserva tus filtros.",
        "<b>Puntualidad</b> frente al equipo y frente al periodo anterior (▲ mejor, ▼ peor).",
        "<b>Devoluciones</b>, también contra el equipo y contra el periodo anterior.",
        "<b>Tendencia</b> de la persona por semana o por mes.",
        "<b>Tareas entregadas</b> con su fecha límite, fecha de entrega, calificación, retraso y devoluciones. El nombre de la tarea abre la tarea.",
      ] },
      { t: "p", x: "Para ADMINISTRADOR, EDITOR y PROJECT 311, la ficha incluye además su <b>gestión</b> (ver siguiente sección). Si la persona captura reportes, aparecen sus <b>reportes</b>, y también su participación en el <b>chat</b> de las tareas." },
    ],
  },
  {
    id: "gestion",
    titulo: "Gestión, reportes y chat",
    bloques: [
      { t: "fig", f: "admin/a05-gestion", c: "Calidad de la asignación y de la gestión", l: [
        "<b>Calidad de la asignación</b>: de las tareas creadas en el periodo, cuántas se editaron después y cuántas se dejaron con la fecha límite por defecto (48 horas). Muchas ediciones o muchas fechas por defecto suelen indicar tareas mal planeadas.",
        "<b>Calidad de la gestión</b>: por cada ADMINISTRADOR, EDITOR y PROJECT 311, cuántas tareas asignan, cuánto tardan en revisar lo que se entrega y qué porcentaje devuelven.",
      ] },
      { t: "p", x: "El dashboard también muestra los <b>reportes</b> terminados y enviados por persona, la tasa de rechazo (se atribuye a quien hizo el reporte), las solicitudes de edición y el tiempo desde que se crea un reporte hasta que se termina; y la <b>participación en el chat</b> de las tareas (mensajes y tiempo de respuesta a un comentario)." },
    ],
  },
  {
    id: "exportar",
    titulo: "Exportar a Excel y configurar el semáforo",
    bloques: [
      { t: "fig", f: "admin/a06-exportar-config", c: "Exportar y configuración", l: [
        "<b>Exportar</b>: cada botón descarga en CSV (se abre en Excel) la tabla que elijas con los <b>filtros actuales</b>: por persona, área, cliente, proyecto, gestión, reportes o tendencia.",
        "<b>Verde desde (%)</b>: la puntualidad mínima para verde.",
        "<b>Ámbar desde (%)</b>: por debajo de este número es rojo.",
        "<b>Medir desde</b>: la fecha a partir de la cual cuentan las tareas.",
        "<b>Guardar configuración</b>.",
      ] },
      { t: "steps", x: [
        "Escribe los porcentajes (el verde debe ser mayor que el ámbar, por ejemplo 90 y 75) <n>2</n> <n>3</n>.",
        "Si lo necesitas, cambia <b>Medir desde</b> <n>4</n>. Esto solo agrega o quita periodos de la medición; no modifica ninguna tarea.",
        "Presiona <b>Guardar configuración</b> <n>5</n>.",
      ] },
      { t: "h3", x: "Resumen semanal por correo" },
      { t: "p", x: "Cada <b>lunes a las 8:00</b> (hora de México) el portal envía un resumen de la <b>semana anterior</b> (de lunes a domingo) únicamente a <b>necesito@311consultores.com</b>. Incluye la puntualidad del equipo, devoluciones, tareas abiertas y vencidas, reportes, una lista de <b>puntos para atender</b> (personas o áreas en rojo y tareas vencidas) y una tabla por área y por persona, con enlace al dashboard." },
      { t: "note", k: "info", x: "El envío lo hace la misma tarea programada de cPanel que ya revisa las tareas cada hora; no hay que configurar nada más. Si el correo falla, se reintenta en la siguiente hora." },
    ],
  },
  {
    id: "areas",
    titulo: "Áreas del equipo",
    bloques: [
      { t: "p", x: "Las áreas dividen al equipo (DISEÑO, CRM, CONSULTORÍA, DESARROLLO, DIRECCIÓN, REDES Y ADS, WEB). Cada <b>tarea</b> pertenece a <b>una</b> área y cada <b>persona</b> puede estar en <b>varias</b>. Sirven para filtrar las tareas y para medir el desempeño por área." },
      { t: "fig", f: "admin/a08-areas", c: "Configuración › General › Áreas del equipo", max: 78, l: [
        "Cada área con su color, cuántas personas y cuántas tareas tiene.",
        "<b>Editar</b>: cambia el nombre o el color.",
        "<b>Desactivar</b> (o Activar): una área desactivada conserva su historial en el dashboard, pero ya no se ofrece al crear tareas.",
        "Nombre de una <b>nueva área</b> (y su color, a la derecha).",
        "<b>Agregar área</b>.",
      ] },
      { t: "h3", x: "Asignar áreas a las personas" },
      { t: "p", x: "Se hace al editar al usuario (ver la siguiente sección). Las personas de TEAM 311 y PROJECT 311 pueden pertenecer a varias áreas." },
    ],
  },
  {
    id: "usuarios",
    titulo: "Usuarios, roles y áreas",
    bloques: [
      { t: "p", x: "En <b>Configuración › Usuarios</b> hay una pestaña por tipo de usuario (TODOS, ADMINISTRADORES, EDITORES, PROJECT 311, TEAM 311 y CLIENTES), un buscador y la opción <b>Mostrar inactivos</b>. «Nuevo usuario» preselecciona el rol de la pestaña en que estás." },
      { t: "h3", x: "Editar un usuario y cambiarle el rol" },
      { t: "steps", x: [
        "En la fila del usuario presiona <b>Editar</b>.",
        "Cambia el <b>Rol</b> <n>1</n> si hace falta: puedes pasar a una persona de un rol a otro (por ejemplo, de TEAM 311 a PROJECT 311). No puedes cambiar tu propio rol ni quitárselo al único ADMINISTRADOR activo.",
        "Corrige el <b>correo</b> <n>2</n> (solo el ADMINISTRADOR lo cambia), la contraseña, la foto o el cumpleaños.",
        "Captura su <b>teléfono / WhatsApp</b> <n>3</n> (10 dígitos): se usa para mandarle tareas por WhatsApp.",
        "Marca sus <b>áreas</b> <n>4</n>: puede estar en varias.",
        "Para el TEAM 311, asigna también los clientes y proyectos de los que puede capturar reportes. Presiona <b>Guardar cambios</b>.",
      ] },
      { t: "fig", f: "admin/a09-editar-usuario", c: "Edición de un usuario TEAM 311", max: 70, l: [
        "Rol.", "Correo.", "Teléfono / WhatsApp.", "Áreas.",
      ] },
      { t: "note", k: "warn", x: "Al cambiar de rol se limpian los datos que ya no aplican: los proyectos asignados para reportes solo existen en TEAM 311 y las áreas solo en TEAM 311 y PROJECT 311. Nunca se borra el historial de la persona." },
      { t: "note", k: "info", x: "El <b>EDITOR</b> también puede crear usuarios <b>CLIENTE</b> y editarlos (nombre, correo, empresa y contraseña), además de activarlos o desactivarlos. No puede cambiar el rol de nadie ni eliminar usuarios: eso es solo del ADMINISTRADOR." },
      { t: "p", x: "<b>Desactivar</b> a un usuario le quita el acceso sin borrar su historial. <b>Eliminar</b> solo es posible si no tiene historial; si lo tiene, el portal te ofrece desactivarlo." },
    ],
  },
  {
    id: "tareas",
    titulo: "Tareas y áreas",
    bloques: [
      { t: "p", x: "Cuando se crea o edita una tarea, el <b>área es obligatoria</b> y se elige libremente (no depende de la persona asignada). En el tablero, cada tarjeta muestra una etiqueta con el color de su área y hay un filtro «Todas las áreas»." },
      { t: "fig", f: "admin/a10-tareas-area", c: "Tablero con filtro y etiquetas de área", l: [
        "Filtro <b>por área</b> (incluye «Sin área»).",
        "Etiqueta de color con el <b>área</b> de la tarea.",
      ] },
      { t: "fig", f: "admin/a11-nueva-tarea-area", c: "Nueva tarea: el campo Área es obligatorio", max: 74, l: [
        "<b>Área</b>: solo aparecen las áreas activas.",
      ] },
      { t: "p", x: "En el detalle de cada tarea, ADMINISTRADOR, EDITOR y PROJECT 311 tienen <b>Copiar enlace de la tarea</b> y un botón verde de <b>WhatsApp</b> por cada persona asignada, que abre WhatsApp con el mensaje «Hola (nombre) te acabo de asignar la tarea: … puedes verla dando click aquí: …»." },
    ],
  },
  {
    id: "prestamos",
    titulo: "Finanzas: préstamos de las cajas",
    bloques: [
      { t: "p", x: "Un <b>préstamo</b> es dinero que se sacó de una o varias cajas (por ejemplo, de la caja Navidad). Conforme entran ingresos, se va <b>abonando</b> a la deuda hasta completarla. Se maneja en <b>Administración › Finanzas › Préstamos</b> y solo lo ve el ADMINISTRADOR." },
      { t: "note", k: "info", x: "Los datos de las imágenes son de ejemplo, no son los reales de la empresa." },
      { t: "h3", x: "Registrar un préstamo" },
      { t: "steps", x: [
        "Entra a <b>Finanzas › Préstamos</b> y presiona <b>Registrar préstamo</b>.",
        "Escribe el <b>concepto</b> <n>1</n>, <b>quién lo recibió</b> <n>2</n> y la <b>fecha</b> del préstamo <n>3</n>.",
        "Elige de qué <b>caja</b> salió el dinero <n>4</n>, si fue de <b>efectivo o banco</b> <n>5</n> y el <b>monto</b> <n>6</n>. Si salió de varias cajas, presiona <b>Agregar otra caja</b> <n>7</n> y captura cada una.",
        "Marca la casilla <n>8</n> <b>solo si ese dinero ya había salido de las cajas antes</b> (por ejemplo, ya se registró como retiro): entonces únicamente se anota la deuda y <b>ningún saldo cambia</b>. Si no la marcas, el dinero se descuenta de las cajas al registrar el préstamo (y el portal avisa si alguna caja no tiene saldo suficiente).",
        "Presiona <b>Registrar préstamo</b> <n>9</n>.",
      ] },
      { t: "fig", f: "admin/a14-nuevo-prestamo", c: "Registrar un préstamo (datos de ejemplo)", l: [
        "Concepto.", "Quién recibió el dinero.", "Fecha del préstamo.", "Caja de la que salió el dinero.", "Procedencia: efectivo o banco.", "Monto.", "Agregar otra caja.", "Casilla «ya salió de las cajas antes».", "Registrar préstamo.",
      ] },
      { t: "h3", x: "Registrar un abono" },
      { t: "p", x: "Cada préstamo es una tarjeta con su avance. Cuando entre dinero para devolver, presiona <b>Registrar abono</b> <n>5</n>, elige a qué caja regresa, si entra como efectivo o banco, el monto y la fecha, y guarda. El dinero <b>sube el saldo de esa caja</b> y la barra de avance se llena." },
      { t: "fig", f: "admin/a13-prestamos", c: "Préstamos: resumen, avance y abonos (datos de ejemplo)", l: [
        "<b>Deuda pendiente</b>, abonado y total prestado.",
        "Registrar un préstamo nuevo.",
        "<b>Barra de avance</b> del préstamo, con lo abonado y lo que falta.",
        "Lista de <b>abonos</b>: fecha, caja a la que regresó, nota y monto.",
        "<b>Registrar abono</b>.",
        "<b>Anular</b> el préstamo (con motivo).",
      ] },
      { t: "bullets", x: [
        "No se puede abonar <b>más de lo que falta</b> pagar a esa caja.",
        "El estado cambia solo: <b>Vigente</b> mientras haya deuda y <b>Pagado</b> cuando los abonos igualan el total.",
        "Puedes tener <b>varios préstamos</b> a la vez; cada uno lleva su propio avance.",
      ] },
      { t: "h3", x: "Aviso al cobrar una factura" },
      { t: "p", x: "Cuando marcas una factura como <b>pagada</b> y hay deuda pendiente, el portal te pregunta si quieres abonar: <b>Registrar abono</b> <n>3</n> te lleva al préstamo con el formulario abierto, y <b>Ahora no</b> <n>2</n> lo deja para después." },
      { t: "fig", f: "admin/a16-aviso-abono", c: "Pregunta después de registrar un cobro", max: 55, l: [
        "Deuda pendiente con las cajas.", "Ahora no.", "Registrar abono.",
      ] },
      { t: "h3", x: "Resumen, historial y correcciones" },
      { t: "fig", f: "admin/a15-resumen-deuda", c: "Finanzas › Resumen: avance de los préstamos", max: 78, l: [
        "Barra de avance del total prestado.", "Ver los préstamos y registrar abonos.",
      ] },
      { t: "bullets", x: [
        "Los préstamos y abonos aparecen en el <b>historial</b> de Finanzas (Resumen y Movimientos, con su filtro por mes) y en la exportación a Excel. No cuentan como ingresos ni egresos de la empresa.",
        "<b>Anular un abono</b>: el dinero sale otra vez de la caja a la que había regresado y la deuda sube; si esa caja ya no tiene saldo, el portal no te deja anularlo.",
        "<b>Anular un préstamo</b>: primero anula sus abonos. Si el dinero salió de las cajas al registrarlo, regresa a ellas.",
        "Nada se borra: lo anulado queda marcado con su motivo.",
      ] },
    ],
  },
  {
    id: "log",
    titulo: "El Log: solicitudes por autorizar",
    bloques: [
      { t: "p", x: "El Editor y el PROJECT 311 <b>no eliminan</b> directamente: lo solicitan con un motivo. El TEAM 311 solicita volver a editar un reporte terminado. Todo llega al <b>Log</b>, donde tú decides." },
      { t: "fig", f: "admin/a12-log", c: "Log", l: [
        "<b>Solicitudes de edición pendientes</b>: apruébalas (el reporte vuelve a «En proceso») o recházalas.",
        "<b>Solicitudes de eliminación pendientes</b>: «Aprobar y eliminar» borra el elemento definitivamente; «Rechazar» lo conserva. Queda registrado quién lo pidió y el motivo.",
      ] },
      { t: "p", x: "Más abajo se conservan las solicitudes ya resueltas y las fusiones de clientes. El globito rojo del menú suma todo lo pendiente." },
    ],
  },
  {
    id: "faq",
    titulo: "Preguntas frecuentes",
    bloques: [
      { t: "faq", items: [
        ["El dashboard no muestra datos de hace meses.", "Solo se mide desde la fecha «Medir desde», que se fijó al activar el dashboard. Puedes cambiarla en la configuración, pero las tareas anteriores no guardan todos los pasos y las cifras saldrían incompletas."],
        ["Una persona sale con «—» en puntualidad.", "No entregó tareas en el periodo y filtros elegidos. Sin tareas no se califica."],
        ["¿Por qué una tarea tardía no baja tanto la puntualidad?", "Porque el descuento es proporcional al plazo: un retraso de 1 día en una tarea de 10 días solo descuenta 10 %."],
        ["Una tarea aparece en «Sin área».", "Es anterior a la actualización de las áreas. Ábrela, presiona Editar y elige su área."],
        ["Registré un préstamo y los saldos de las cajas cambiaron (o no).", "Si marcaste «ya salió de las cajas antes», no cambia ningún saldo: solo se anota la deuda. Si no la marcaste, el dinero se descontó de las cajas al registrarlo."],
        ["No me deja abonar el monto que quiero.", "Un abono no puede ser mayor a lo que falta pagar a esa caja. Elige otra caja del préstamo o un monto menor."],
        ["Me equivoqué en un abono o en un préstamo.", "Anúlalo con su motivo: el dinero regresa al lugar de donde salió y el registro queda marcado como anulado. Para anular un préstamo, primero anula sus abonos."],
        ["Desactivé un área y sigue en el dashboard.", "Es lo esperado: conserva su historial. Solo deja de ofrecerse al crear tareas."],
        ["No me llegó el resumen del lunes.", "Se envía a necesito@311consultores.com después de las 8:00. Si el hosting estaba fuera de línea, se reintenta cada hora durante ese lunes."],
      ] },
    ],
  },
  {
    id: "resumen",
    titulo: "Resumen rápido",
    bloques: [
      { t: "table", head: ["Quiero…", "Cómo"], rows: [
        ["Ver el desempeño del equipo", "Administración › <b>Desempeño</b>; elige periodo y filtros → <b>Aplicar</b>."],
        ["Ver el detalle de una persona", "En «Por persona», clic en su nombre (<b>ficha</b>)."],
        ["Exportar a Excel", "Sección <b>Exportar</b> del dashboard → botón de la tabla."],
        ["Cambiar el semáforo", "Sección <b>Configuración</b> del dashboard → verde, ámbar, medir desde → Guardar."],
        ["Crear o desactivar un área", "Configuración › <b>General</b> › Áreas del equipo."],
        ["Asignar áreas a una persona", "Configuración › <b>Usuarios</b> › Editar › Áreas."],
        ["Cambiar el rol de un usuario", "Usuarios › Editar › <b>Rol</b> → Guardar cambios."],
        ["Registrar un préstamo o un abono", "Administración › <b>Finanzas</b> › <b>Préstamos</b> → Registrar préstamo / Registrar abono."],
        ["Autorizar una eliminación o edición", "Configuración › <b>Log</b> → Aprobar o Rechazar."],
      ] },
    ],
  },
];
