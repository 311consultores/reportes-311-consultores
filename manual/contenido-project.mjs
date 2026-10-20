// Contenido del manual del usuario PROJECT 311. Mismos bloques que contenido.mjs (p, h3, steps, bullets, note, fig, table, faq).
export const URL_SISTEMA = "https://reportes.311consultores.com";

export const secciones = [
  {
    id: "antes",
    titulo: "Antes de empezar",
    bloques: [
      { t: "p", x: "Este manual explica, paso a paso y con imágenes, cómo usar el <b>Portal de Operaciones de 311 Consultores</b> con el perfil <b>PROJECT 311</b>. No necesitas saber de computación: cada tarea se describe con instrucciones del tipo «haz clic aquí, escribe esto, verás aquello»." },
      { t: "h3", x: "Tu perfil: PROJECT 311" },
      { t: "p", x: "El perfil <b>PROJECT 311</b> es el que lleva el control de las <b>tareas</b> del equipo. Puedes:" },
      { t: "bullets", x: [
        "Ver <b>todas</b> las tareas del portal, no solo las tuyas, y buscarlas por nombre, cliente, persona o comentarios.",
        "<b>Crear</b> tareas y asignarlas a cualquier persona del equipo interno: ADMINISTRADOR, EDITOR, PROJECT 311 o TEAM 311.",
        "<b>Recibir</b> tareas que otras personas te asignen y trabajarlas igual que el TEAM 311.",
        "<b>Editar</b> cualquier tarea: nombre, fecha de entrega, descripción, personas, subtareas y recursos.",
        "<b>Mover</b> las tareas a cualquier fase, <b>aceptar</b> las que están «Para revisar» o devolverlas con un comentario.",
        "Conversar en el <b>chat</b> de cada tarea, con formato, emojis, GIF y archivos.",
        "Guardar tus notas privadas en el <b>Baúl</b> y convertirlas en tareas.",
        "Consultar <b>Clientes y proyectos</b> (solo lectura) para elegirlos al crear tareas.",
        "Tener tu <b>perfil</b> con foto y cumpleaños, y recibir avisos en la campanita, el correo y el navegador o celular.",
      ] },
      { t: "note", k: "info", x: "Tu perfil es de <b>gestión de tareas</b>, no de administración de la plataforma. No ves Reportes, Facturas, Finanzas, Usuarios ni el Registro de clientes, y no puedes eliminar tareas directamente: <b>solicitas</b> la eliminación y la autoriza el Administrador." },
      { t: "h3", x: "Palabras que vas a ver" },
      { t: "table", head: ["Palabra", "Qué significa"], rows: [
        ["Tarea", "Un trabajo concreto que se le pide a una persona del equipo, con fecha y hora de entrega."],
        ["Fases", "PENDIENTE, EN PROCESO, PARA REVISAR y TERMINADA: el camino de cada tarea en el tablero."],
        ["Subtarea", "Un renglón de una lista de verificación dentro de la tarea, con su casilla para marcar cuando se hace."],
        ["Recurso", "Un enlace (por ejemplo, una carpeta de Drive) que ayuda a hacer la tarea."],
        ["Aceptar", "Dar por buena una tarea que quedó «Para revisar»: pasa a TERMINADA."],
        ["Baúl", "Tu espacio de notas privadas, estilo Google Keep."],
      ] },
    ],
  },
  {
    id: "entrar",
    titulo: "Entrar y salir del portal",
    bloques: [
      { t: "steps", x: [
        "Abre el navegador (Chrome, Edge, Safari) y entra a <b>reportes.311consultores.com</b>.",
        "Escribe tu <b>correo</b> y tu <b>contraseña</b> y presiona <b>Entrar</b>. Si no la recuerdas, usa «¿Olvidaste tu contraseña?».",
        "Llegarás directo al panel de <b>Tareas</b>. Para salir, usa <b>Cerrar sesión</b> en la esquina inferior izquierda.",
      ] },
      { t: "note", k: "tip", x: "Si entras desde el celular, el portal te ofrecerá <b>instalar la app</b> en la pantalla de inicio. Los pasos están en la sección «App, avisos y perfil»." },
    ],
  },
  {
    id: "pantalla",
    titulo: "Tu pantalla y el menú",
    bloques: [
      { t: "p", x: "El menú está a la izquierda. Tu menú es corto a propósito: solo incluye lo que usas." },
      { t: "fig", f: "project/p01-menu", c: "Menú del perfil PROJECT 311", max: 34, l: [
        "<b>Tareas</b>: el tablero de tareas. El globito rojo indica cuántas están «Para revisar».",
        "<b>Baúl</b>: tus notas privadas.",
        "<b>Clientes y proyectos</b>: consulta de clientes y proyectos (solo lectura).",
        "<b>App y avisos</b>: instalar la app y activar las notificaciones.",
        "Tu nombre y foto: abre <b>Mi perfil</b>.",
        "<b>Avisos</b> (campana): lo nuevo que te ha pasado.",
        "<b>Cerrar sesión</b>.",
      ] },
    ],
  },
  {
    id: "tareas",
    titulo: "El tablero de tareas",
    bloques: [
      { t: "p", x: "Aquí ves todas las tareas del equipo en columnas, según su fase. Para cambiar de fase, <b>arrastra</b> la tarjeta a otra columna o usa «Mover a» dentro de la tarea." },
      { t: "fig", f: "project/p02-tablero", c: "Tablero de tareas", l: [
        "<b>Nueva tarea</b>: crea y asigna una tarea.",
        "<b>Buscador</b>: escribe 2 letras o más y aparecen tareas que coinciden (nombre, cliente, personas, comentarios, subtareas).",
        "Cambia entre <b>Tablero</b> y <b>Calendario</b> (puedes arrastrar una tarea a otro día para reprogramarla).",
        "Filtra por <b>persona</b>, <b>cliente</b> o <b>proyecto</b>.",
        "Cada columna es una <b>fase</b> y su número indica cuántas tareas tiene.",
        "Una <b>tarjeta</b>: se ve el cliente, el proyecto, las personas, el avance de subtareas y la fecha. En rojo está vencida; en naranja, por vencer en 12 horas.",
        "<b>Para revisar</b>: las que ya entregó alguien y esperan tu aceptación.",
        "<b>Historial</b>: tareas terminadas que ya no están en el tablero.",
      ] },
      { t: "note", k: "info", x: "«Limpiar terminadas» oculta del tablero las tareas terminadas; siguen en el Historial." },
    ],
  },
  {
    id: "crear",
    titulo: "Crear y asignar una tarea",
    bloques: [
      { t: "steps", x: [
        "En Tareas, presiona <b>Nueva tarea</b>.",
        "Elige el <b>cliente</b> <n>1</n> y luego el <b>proyecto</b> <n>2</n>.",
        "En <b>Asignar a</b> <n>3</n> haz clic y escribe para buscar. Aparece la lista de todo el equipo <n>4</n>: elige a una o varias personas. Puedes asignar a ADMINISTRADORES, EDITORES, PROJECT 311 y TEAM 311.",
        "Escribe el <b>nombre de la tarea</b>, la <b>fecha y hora de entrega</b> (por defecto, 48 horas después) y, si quieres, la <b>descripción</b>.",
        "Opcional: agrega <b>subtareas</b> (cada una con nombre, persona responsable y fecha) y <b>recursos</b> (título y enlace).",
        "Presiona <b>Asignar tarea</b>. Las personas elegidas reciben un aviso en el portal, en el navegador y por correo.",
      ] },
      { t: "fig", f: "project/p03-nueva-tarea", c: "Nueva tarea: la lista de personas incluye a todo el equipo interno", max: 70, l: [
        "Cliente.",
        "Proyecto (aparecen los del cliente elegido).",
        "Buscador de personas.",
        "Lista del equipo: ADMINISTRADOR, EDITOR, PROJECT 311 y TEAM 311.",
      ] },
      { t: "note", k: "tip", x: "Las personas de las subtareas se eligen solo entre las que asignaste a la tarea." },
    ],
  },
  {
    id: "detalle",
    titulo: "Abrir, editar y dar seguimiento a una tarea",
    bloques: [
      { t: "p", x: "Haz clic en una tarjeta para abrir su detalle." },
      { t: "fig", f: "project/p04-detalle", c: "Detalle de una tarea", max: 50, l: [
        "<b>Subtareas</b>: marca o desmarca las casillas; la barra muestra el avance.",
        "<b>Comentarios</b>: el chat de la tarea. Se avisa a las personas involucradas.",
        "<b>Mover a</b>: pasa la tarea a cualquier fase.",
        "<b>Editar</b>: cambia nombre, fecha, descripción, personas, subtareas y recursos.",
        "<b>Solicitar eliminación</b>: pide al Administrador que la elimine (con motivo).",
      ] },
      { t: "h3", x: "Editar una tarea" },
      { t: "steps", x: [
        "Abre la tarea y presiona <b>Editar</b>.",
        "Cambia lo que necesites. Si agregas personas nuevas, se les avisa; si quitas a alguien, deja de verla.",
        "Presiona <b>Guardar cambios</b>. Todo queda anotado en el <b>Historial</b> de la tarea.",
      ] },
      { t: "h3", x: "Reprogramar desde el calendario" },
      { t: "p", x: "En la vista <b>Calendario</b> arrastra una tarea a otro día: la fecha cambia, conserva la hora y se avisa a las personas asignadas." },
    ],
  },
  {
    id: "aceptar",
    titulo: "Revisar, aceptar o devolver",
    bloques: [
      { t: "p", x: "Cuando alguien termina su trabajo marca la tarea como <b>Lista</b> y pasa a <b>PARA REVISAR</b>. Tú, como PROJECT 311, recibes el aviso y la revisas." },
      { t: "h3", x: "Aceptar" },
      { t: "steps", x: [
        "Arrastra la tarjeta a <b>TERMINADA</b> (o usa «Mover a»).",
        "Aparece la ventana «Aceptar la tarea»: escribe un <b>mensaje</b> <n>1</n> si quieres felicitar o comentar.",
        "Si lo deseas, deja marcada la <b>sorpresa</b> <n>2</n> de felicitación para la persona.",
        "Presiona <b>Aceptar tarea</b> <n>3</n>. La persona recibe un aviso de que su tarea fue aceptada.",
      ] },
      { t: "fig", f: "project/p05-aceptar", c: "Aceptar una tarea", max: 70, l: [
        "Mensaje para la persona.",
        "Sorpresa de felicitación.",
        "Confirmar.",
      ] },
      { t: "h3", x: "Devolver para corregir" },
      { t: "p", x: "Arrastra la tarea de <b>PARA REVISAR</b> a <b>EN PROCESO</b>. El sistema te pide un <b>comentario obligatorio</b> que explique qué falta; la persona lo recibe por aviso y por correo." },
      { t: "note", k: "info", x: "Como puedes mover una tarea a cualquier fase, también puedes regresar una tarea terminada si hace falta. Al hacerlo se quita su aceptación." },
    ],
  },
  {
    id: "eliminar",
    titulo: "Eliminar una tarea",
    bloques: [
      { t: "p", x: "No puedes eliminar una tarea directamente. Lo que haces es <b>solicitar la eliminación</b>:" },
      { t: "steps", x: [
        "Abre la tarea y presiona <b>Solicitar eliminación</b>.",
        "Escribe el <b>motivo</b> y confirma.",
        "La solicitud llega al Administrador, quien la aprueba o la rechaza. Queda registrada con tu nombre y el motivo.",
      ] },
    ],
  },
  {
    id: "clientes",
    titulo: "Consultar clientes y proyectos",
    bloques: [
      { t: "p", x: "En <b>Clientes y proyectos</b> ves las empresas y sus proyectos para saber cómo se llaman al crear tareas. Es solo de consulta." },
      { t: "fig", f: "project/p06-clientes", c: "Clientes y proyectos (solo lectura)", l: [
        "Buscador por cliente, proyecto o correo.",
        "Tarjeta de un cliente: su logo, prefijo y proyectos.",
        "Ver el detalle: proyectos, responsables y correos.",
      ] },
      { t: "note", k: "info", x: "No puedes dar de alta ni modificar clientes, ni ves sus datos fiscales. Si falta un cliente o proyecto, pídelo a un Editor o al Administrador." },
    ],
  },
  {
    id: "baul",
    titulo: "El Baúl: tus notas privadas",
    bloques: [
      { t: "p", x: "El <b>Baúl</b> funciona como las notas de Google Keep y es <b>privado</b>: solo tú ves tus notas (ni siquiera el Administrador puede ver las ajenas). Si quieres que otra persona vea una nota, la compartes con ella." },
      { t: "bullets", x: [
        "<b>Crear</b>: haz clic en «Escribe una nota…». Puede ser texto con formato o una <b>lista con casillas</b>.",
        "<b>Color</b> pastel, <b>fijar</b> arriba y <b>reordenar</b> arrastrando.",
        "<b>Etiquetas</b> propias para encontrar rápido tus notas.",
        "<b>Recordatorio</b>: fecha y hora; te avisan en la campanita, el navegador y por correo.",
        "<b>Vincular</b> la nota a un cliente, proyecto o tarea.",
        "<b>Compartir</b> con personas concretas: solo ver o puede editar. Solo tú cambias con quién se comparte.",
        "<b>Convertir en tarea</b>: abre «Nueva tarea» ya con el título y la descripción de la nota; los elementos de una lista pasan a ser <b>subtareas</b>.",
        "<b>Archivar</b> y <b>papelera</b> (30 días antes de borrarse definitivamente).",
      ] },
      { t: "note", k: "warn", x: "No guardes contraseñas en el Baúl." },
    ],
  },
  {
    id: "app",
    titulo: "App, avisos y perfil",
    bloques: [
      { t: "h3", x: "Mi perfil" },
      { t: "p", x: "Haz clic en tu nombre, abajo en el menú. Ahí cambias tu <b>foto</b> (con recortador) y tu <b>cumpleaños</b> (solo día y mes). La foto se ve en el menú, en los chats y en las tareas." },
      { t: "fig", f: "project/p07-perfil", c: "Mi perfil", max: 70, l: [
        "Tu foto.",
        "Fecha de cumpleaños.",
        "Guardar.",
      ] },
      { t: "h3", x: "Avisos" },
      { t: "p", x: "La <b>campana</b> reúne los avisos de tareas: nuevas, listas para revisar, devueltas, aceptadas, mensajes, por vencer y vencidas, además de lo que se comparte contigo en el Baúl. Solo recibes avisos relacionados con <b>tareas</b>: no te llegan los de reportes, registros de clientes ni facturas." },
      { t: "h3", x: "Instalar la app y activar notificaciones" },
      { t: "p", x: "En <b>App y avisos</b> (menú, Configuración) puedes instalar el portal como app en tu celular o computadora y activar las <b>notificaciones del navegador</b> en ese dispositivo, eligiendo qué tipos quieres recibir." },
      { t: "steps", x: [
        "<b>Android / Chrome:</b> presiona el botón <b>Instalar</b>.",
        "<b>iPhone / iPad:</b> en Safari toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>.",
        "En <b>App y avisos</b> presiona <b>Activar notificaciones</b> y acepta el permiso del navegador.",
      ] },
    ],
  },
  {
    id: "limites",
    titulo: "Lo que no puedes hacer y a quién pedirlo",
    bloques: [
      { t: "table", head: ["Quiero…", "A quién pedirlo"], rows: [
        ["Eliminar una tarea", "Presiona «Solicitar eliminación»; la autoriza el Administrador."],
        ["Crear o editar usuarios", "Al Administrador o a un Editor."],
        ["Dar de alta un cliente o proyecto, o corregir sus datos", "A un Editor o al Administrador."],
        ["Ver o crear reportes", "Tu perfil no incluye reportes. Pídelo al Administrador si lo necesitas."],
        ["Ver facturas o finanzas", "Al Administrador."],
        ["Que me llegue un correo distinto o cambiar mi correo", "Al Administrador."],
      ] },
    ],
  },
  {
    id: "faq",
    titulo: "Preguntas frecuentes",
    bloques: [
      { t: "faq", items: [
        ["No veo la tarea que busco.", "Escribe 2 letras o más en el buscador. Si está terminada y oculta, entra a <b>Historial</b>."],
        ["Asigné una tarea a la persona equivocada.", "Ábrela, presiona <b>Editar</b>, quita a la persona y agrega a la correcta. Se avisa a quien se agrega."],
        ["No me llegan las notificaciones del navegador.", "Entra a <b>App y avisos</b> en ese dispositivo y presiona <b>Activar notificaciones</b>. En iPhone primero instala la app en la pantalla de inicio."],
        ["Devolví una tarea y no me dejó continuar.", "Al devolver de «Para revisar» a «En proceso» es obligatorio escribir un comentario."],
        ["Olvidé mi contraseña.", "En la pantalla de entrada usa «¿Olvidaste tu contraseña?» y sigue las instrucciones que llegan a tu correo."],
      ] },
    ],
  },
  {
    id: "resumen",
    titulo: "Resumen rápido",
    bloques: [
      { t: "table", head: ["Quiero…", "Cómo"], rows: [
        ["Crear una tarea", "Tareas → <b>Nueva tarea</b> → cliente, proyecto, personas, fecha → <b>Asignar tarea</b>."],
        ["Editarla", "Abrir la tarea → <b>Editar</b> → <b>Guardar cambios</b>."],
        ["Cambiar de fase", "Arrastrar la tarjeta o usar <b>Mover a</b>."],
        ["Aceptar", "Arrastrar de PARA REVISAR a TERMINADA → mensaje → <b>Aceptar tarea</b>."],
        ["Devolver", "De PARA REVISAR a EN PROCESO con comentario."],
        ["Pedir que se elimine", "<b>Solicitar eliminación</b> dentro de la tarea."],
        ["Buscar", "Escribir 2 letras o más en el buscador de Tareas."],
        ["Convertir una nota en tarea", "Baúl → abrir la nota → <b>Convertir en tarea</b>."],
      ] },
    ],
  },
];
