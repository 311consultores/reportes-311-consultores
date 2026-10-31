// Contenido nuevo de los manuales (Evolutivos 14 a 17): Documentos, proyectos desde el reporte, reordenar actividades, PDF del reporte,
// cambio de perfil, Finanzas (cajas, DEV y reparto) y Revisiones de parrillas. Cada manual llama a aplicarE17(secciones, perfil) al final.
// Bloques: p, h3, steps, bullets, note (tip|warn|info), fig, table, faq (ver build.mjs).

const f = (file, c, l, max) => ({ t: "fig", f: file, c, l, ...(max ? { max } : {}) });

// ---------------------------------------------------------------- Documentos
const documentos = (admin) => ({
  id: "documentos",
  titulo: "Documentos: recibos, acuerdos y contratos",
  bloques: [
    { t: "p", x: "En <b>Administración › Documentos</b> el portal arma por ti tres documentos de la empresa: el <b>recibo de pago</b> (pagos en efectivo), el <b>acuerdo de confidencialidad</b> y el <b>contrato de prestación de servicios</b>. Solo capturas lo que cambia; el resto del texto es el de siempre. Antes de enviarlo ves una <b>vista previa</b> para leerlo y validarlo, y puedes descargarlo en <b>PDF y Word</b> o mandarlo por correo. Lo usan el ADMINISTRADOR y el EDITOR." },
    { t: "note", k: "info", x: admin ? "Los datos fijos de la empresa (razón social, domicilio, RFC, representante, cargos, personas que reciben pagos, firmas y contacto) se capturan <b>una sola vez</b> en <b>Documentos › Configuración</b> (ver la sección «Documentos: configuración»). Si falta alguno, el portal te lo avisa." : "Los datos fijos de la empresa los captura el ADMINISTRADOR una sola vez en <b>Documentos › Configuración</b>. Si falta alguno, el portal te avisa y te dice qué falta; tú solo capturas lo que cambia en cada documento." },
    f("e18-documentos", "Documentos: nuevo documento, filtros e historial", [
      "<b>Recibo de pago</b>: nuevo recibo con folio automático.",
      "<b>Acuerdo de confidencialidad</b>.",
      "<b>Contrato de prestación de servicios</b>.",
      "Filtros por tipo, cliente y estado.",
      "Historial: cada documento con su estado (<b>Borrador</b> o <b>Enviado</b>); haz clic para abrirlo.",
    ]),
    { t: "h3", x: "Recibo de pago" },
    { t: "steps", x: [
      "Presiona <b>Recibo de pago</b> y elige el <b>cliente</b>: se llenan solos su nombre y empresa.",
      "Agrega los <b>conceptos</b>: una descripción y un monto por renglón (puedes poner varios; el total se suma solo).",
      "Elige quién <b>confirma de recibido</b> (la lista sale de la configuración) y, si quieres, marca que se incluya su <b>firma</b> escaneada.",
      "Presiona <b>Guardar y ver vista previa</b>.",
    ] },
    { t: "p", x: "El <b>folio</b> se genera solo: el prefijo del cliente (el mismo de sus reportes) y un consecutivo de dos dígitos, por ejemplo <b>CSA01</b>, <b>CSA02</b>… El consecutivo es propio de los recibos de ese cliente." },
    f("e20-recibo-pdf", "Recibo de pago generado (datos de ejemplo)", [], 55),
    { t: "h3", x: "Acuerdo de confidencialidad" },
    { t: "steps", x: [
      "Presiona <b>Acuerdo de confidencialidad</b> y elige el <b>cliente</b>: se llenan solos la razón social, el domicilio y los datos de su representante legal, si ya los capturaste antes.",
      "Revisa o completa los datos del <b>representante legal</b> del cliente (nombre, domicilio, CURP e INE). Déjalos marcados en «Guardar estos datos» para no volver a capturarlos.",
      "Elige el <b>cargo</b> de quien firma por la empresa, la <b>duración</b> (6 meses), los <b>años adicionales</b> de confidencialidad (2) y la <b>pena convencional</b>: el portal la escribe sola en letra («cincuenta mil pesos 00/100 M.N.»).",
      "Si hace falta, agrega una <b>cláusula adicional</b> con su título; sale antes de las firmas.",
      "Presiona <b>Guardar y ver vista previa</b>.",
    ] },
    { t: "h3", x: "Contrato de prestación de servicios" },
    { t: "steps", x: [
      "Presiona <b>Contrato</b> y elige el <b>cliente</b> <n>1</n>; se llenan solos sus datos y los de su representante.",
      "Escribe el <b>ramo</b> del cliente <n>2</n> (por ejemplo «ferretero»).",
      "Marca los <b>servicios</b> que aplican <n>3</n>: en el contrato salen como A, B, C… en ese orden. Si hace falta, agrega otro servicio con su descripción.",
      "En el <b>calendario de pagos</b> escribe, por renglón, el mes <n>4</n> y el monto, y si lleva <b>+ IVA</b>. Con <b>Agregar pago</b> <n>5</n> se suma otro renglón con el mes siguiente. El <b>total del contrato</b> y cada monto <b>en letra</b> se calculan solos.",
      "Revisa la <b>duración</b>, los años de confidencialidad, la <b>penalidad</b> por rescisión <n>6</n>, los días de prórroga para pagar y el correo al que se notifica la rescisión por falta de pago.",
      "Presiona <b>Guardar y ver vista previa</b>.",
    ] },
    f("e19-contrato-form", "Formulario del contrato (datos de ejemplo)", [
      "Cliente del portal.", "Ramo o giro del cliente.", "Servicios del contrato (casillas).", "Mes y monto de cada pago.", "Agregar otro pago.", "Penalidad por rescisión unilateral.",
    ]),
    { t: "note", k: "info", x: "En el contrato, las cláusulas de rescisión están unidas en una sola, la confidencialidad es de 2 años para ambas partes y ya no se menciona el Anexo A. Los textos son los de los archivos originales; conviene que quien lleva lo legal los lea una vez en el PDF." },
    { t: "h3", x: "Vista previa, descarga y envío" },
    { t: "steps", x: [
      "Al guardar aparece el documento completo en <b>vista previa</b>. Léelo con calma.",
      "Si algo no está bien, presiona <b>Editar datos</b>, corrige y vuelve a guardar (solo mientras sea <b>Borrador</b>).",
      "Puedes <b>descargar el PDF</b> o el <b>Word</b> (para editarlo a mano) y <b>duplicar</b> el documento para hacer uno parecido.",
      "Para enviarlo por correo marca <b>«Lo leí y está correcto»</b> (sin esa casilla no se puede enviar), revisa los <b>destinatarios</b> (vienen de los correos del cliente; puedes cambiarlos), el asunto y el mensaje, y presiona <b>Enviar</b>.",
    ] },
    { t: "bullets", x: [
      "El correo sale por el mismo Gmail del portal, con el PDF adjunto y una <b>copia oculta</b> automática a necesito@311consultores.com.",
      "Un documento <b>enviado</b> ya no se edita: si necesitas un cambio, <b>duplícalo</b>. Cada envío queda en el historial con quién lo mandó y cuándo.",
      "Los nombres de archivo siguen la costumbre: «ACUERDO DE CONFIDENCIALIDAD Y NO DIVULGACIÓN - CLIENTE 281026» (cliente y fecha DDMMAA).",
      ...(admin ? ["Solo el ADMINISTRADOR puede <b>eliminar</b> un borrador que nunca se envió."] : ["Un borrador que nunca se envió solo lo elimina el ADMINISTRADOR."]),
    ] },
    { t: "note", k: "warn", x: "<b>El envío no se puede deshacer.</b> Por eso el portal pide la casilla de confirmación después de la vista previa." },
  ],
});

// ---------------------------------------------------------------- Documentos: configuración (ADMIN)
const docConfig = {
  id: "docconfig",
  titulo: "Documentos: configuración",
  bloques: [
    { t: "p", x: "Lo que no cambia de un documento a otro se captura <b>una sola vez</b> en <b>Documentos › Configuración</b> (botón arriba a la derecha). Solo el ADMINISTRADOR entra aquí; el EDITOR ve el módulo Documentos pero no esta pantalla. Los datos se guardan en la base de datos privada del portal, no en el código." },
    f("admin/a23-doc-config", "Documentos › Configuración (datos de ejemplo)", [
      "<b>Datos de la empresa</b>: razón social, RFC, domicilio, representante (nombre, domicilio e INE) y ciudad de firma. Son los que aparecen en acuerdos y contratos.",
      "<b>Cargos</b> de quien firma por la empresa, uno por renglón; al hacer cada documento se elige uno.",
      "<b>Confirma de recibido</b>: las personas autorizadas para los recibos, con su <b>firma escaneada</b> opcional (PNG o JPG, hasta 2 MB).",
      "<b>Contacto del pie</b> de reportes y recibos (correo y teléfonos), la <b>copia oculta</b> de cada envío y el correo para notificar una <b>rescisión por falta de pago</b>.",
      "<b>Guardar configuración</b>.",
    ]),
    { t: "bullets", x: [
      "Los documentos ya hechos conservan los datos de la empresa con los que se crearon: cambiar la configuración no altera un documento viejo.",
      "Mientras falten datos de la empresa (razón social, domicilio, RFC, representante) no se pueden crear acuerdos ni contratos; el portal avisa qué falta.",
      "El contacto del pie aparece al final de cada <b>reporte en PDF</b> y en la franja oscura de cada <b>recibo</b>.",
    ] },
  ],
};

// ---------------------------------------------------------------- Revisiones
const revisiones = (perfil) => ({
  id: "revisiones",
  titulo: "Revisiones de parrillas para redes sociales",
  bloques: [
    { t: "p", x: "Una <b>revisión</b> es el paquete de publicaciones (copy y arte) que le presentas al cliente antes de publicarlas en sus redes. El cliente las revisa en un visor tipo presentación, comenta, <b>aprueba</b> lo que está bien y <b>envía sus ajustes</b>. Tú recibes esos ajustes como <b>una tarea con subtareas</b>, los corriges y se los regresas. Está en <b>Operación › Revisiones</b>." },
    { t: "table", head: ["Paso", "Quién", "Qué pasa"], rows: [
      ["1. Crear y armar", perfil === "project" ? "PROJECT 311 (o ADMIN / EDITOR)" : "ADMIN, EDITOR o PROJECT 311", "Se capturan los datos, se agregan los slides (copy + arte) y se ordenan. Queda en <b>Borrador</b>: el cliente no lo ve. El TEAM 311 puede entrar a editar los borradores de sus proyectos."],
      ["2. Publicar", "Quien armó la revisión", "<b>Publicar al cliente</b>: le llega un correo con el enlace."],
      ["3. Revisar", "El cliente", "Ve cada slide, comenta el copy y el arte por separado, aprueba y presiona <b>Enviar ajustes</b>."],
      ["4. Ajustes", "El equipo", "Se crea <b>una tarea</b> en el área REDES Y ADS con una subtarea por comentario, asignadas a quien lleva copy y a quien lleva arte."],
      ["5. Corregir y devolver", "El equipo", "Se corrige, se marca cada ajuste como hecho y se pulsa <b>Enviar al cliente</b>: empieza una ronda nueva."],
      ["6. Aprobación", "El cliente", "Cuando todos los slides están aprobados, la revisión se cierra con registro de quién aprobó y cuándo, y se puede descargar un <b>PDF resumen</b>."],
    ] },
    f("e21-revisiones-lista", "Operación › Revisiones", [
      "<b>Nueva revisión</b> (solo ADMINISTRADOR, EDITOR y PROJECT 311).",
      "Filtros por estado: Borradores, Esperando al cliente, Ajustes por hacer y Aprobadas.",
      "Lista: cliente, estado, ronda, avance (slides aprobados), quién atiende copy y arte, y la fecha límite del cliente.",
    ]),
    { t: "h3", x: "Crear la revisión" },
    { t: "steps", x: [
      "Presiona <b>Nueva revisión</b>.",
      "Elige el <b>cliente</b> y su <b>proyecto</b> <n>1</n>, y escribe el <b>título</b> <n>2</n> (por ejemplo «Parrilla noviembre 2026»).",
      "Elige quién atiende los <b>ajustes de COPY</b> <n>3</n> y quién los de <b>ARTE</b> <n>4</n>; salen de las personas del TEAM 311. A ellas les llegará la tarea.",
      "Indica la fecha en que el cliente debe responder <n>5</n>: un día antes le llega un recordatorio por correo.",
      "Revisa los <b>correos a los que se avisa</b> <n>6</n>: vienen los del cliente y del proyecto; quita o agrega los que quieras.",
      "Presiona <b>Crear y agregar slides</b>.",
    ] },
    f("e22-nueva-revision", "Nueva revisión (datos de ejemplo)", [
      "Proyecto del cliente.", "Título de la revisión.", "Quién atiende los ajustes de copy.", "Quién atiende los ajustes de arte.", "Fecha límite de respuesta del cliente.", "Correos a los que se avisa.",
    ], 80),
    { t: "h3", x: "Agregar los slides" },
    { t: "p", x: "Cada <b>slide</b> es una publicación. Presiona <b>Agregar slide</b> <n>3</n> y llénalo; todo se guarda solo." },
    f("e23-armar-revision", "Revisión en borrador: datos generales y lista de slides", [
      "<b>Publicar al cliente</b> (se activa cuando hay al menos un slide).",
      "Datos generales: título, responsables, fecha límite y correos (<b>Guardar datos generales</b>).",
      "<b>Agregar slide</b>.",
      "<b>Asa ⋮⋮</b> para arrastrar y cambiar el orden (también hay flechas ↑ ↓).",
      "Eliminar el slide.",
    ]),
    f("e23b-slide-abierto", "Un slide abierto", [
      "<b>Copy</b> de la publicación (hasta 2,200 caracteres, con contador).",
      "<b>Canal</b> (Facebook o Instagram) y fecha de publicación opcional.",
      "<b>Arte</b>: sube una imagen, varias (carrusel de hasta 10) o un video. Imágenes JPG o PNG hasta 8 MB; video MP4, WEBM o MOV hasta 100 MB.",
      "<b>Simular vista en redes</b>.",
    ], 80),
    { t: "h3", x: "Simular cómo se verá" },
    f("e24-simulador", "Simulación de la publicación", [
      "Facebook.", "Instagram.", "Formato: cuadrado 1:1, vertical 4:5 o historia 9:16.",
    ], 60),
    { t: "p", x: "Muestra el logo y el nombre del cliente, el copy cortado con «Ver más», el carrusel que se desliza y el video con reproducción. Es una simulación <b>referencial</b>: el aspecto final puede variar un poco según el dispositivo. En historias el texto no se muestra debajo de la imagen." },
    { t: "h3", x: "Publicar al cliente" },
    { t: "steps", x: [
      "Presiona <b>Publicar al cliente</b>. El portal revisa que <b>cada slide tenga copy y arte</b>; si falta algo, te dice cuáles slides.",
      "Confirma en la ventana: se mandará un correo a los correos de aviso.",
      "La revisión pasa a <b>Esperando al cliente</b> y ya no se pueden agregar, quitar ni reordenar slides.",
    ] },
    { t: "h3", x: "Lo que ve el cliente" },
    f("e28-cliente-lista", "Pestaña «Revisiones» del cliente", [
      "<b>Globo rojo</b> con las revisiones que esperan su respuesta.",
      "Secciones: Por revisar, En ajustes y Aprobadas.",
      "Tarjeta con miniaturas, avance y fecha límite.",
      "<b>Iniciar revisión</b> (o Continuar revisión / Revisar ajustes). Al empezar, un aviso le agradece su tiempo y le sugiere terminarla en una sola sesión.",
    ]),
    f("e29-cliente-visor", "Visor de la revisión", [
      "Miniaturas: globo naranja si hay comentarios; palomita verde si está aprobado.",
      "<b>Copy</b> del slide.",
      "<b>Arte</b> (imagen, carrusel con flechas o video) y el botón para simular la publicación.",
      "<b>Aprobar slide</b>.",
      "Comentarios: pestañas Copy, Arte e Historial. Se guardan solos. En un carrusel indica «sobre la imagen N»; en un video, el segundo exacto.",
      "<b>Enviar ajustes</b> (con el número de comentarios).",
    ]),
    f("e30-cliente-aprobar", "Aviso al aprobar un slide", ["Confirmar la aprobación."], 55),
    { t: "bullets", x: [
      "Al <b>aprobar</b> un slide, el portal le avisa que ya <b>no podrá enviar más ajustes</b> sobre él y que, si necesita un cambio, lo pida en el grupo de trabajo por WhatsApp.",
      "No puede aprobar un slide que tenga comentarios sin enviar, y no puede enviar ajustes mientras le falte revisar algún slide (apruébalo o coméntalo).",
      "Al enviar ajustes ve un aviso: el tiempo promedio de corrección es de <b>24 a 48 horas</b>.",
    ] },
    { t: "h3", x: "Cuando el cliente envía ajustes" },
    { t: "p", x: "Llega una campanita (y aviso del navegador) a quienes gestionan, y a la persona que atiende cada ajuste le llega <b>la tarea</b>. La tarea se llama «Ajustes · (revisión) · Ronda N», queda en el área <b>REDES Y ADS</b>, con entrega a 48 horas, y trae una subtarea por comentario con el texto del cliente." },
    f("e26-tarea-ajustes", "La tarea de ajustes", [
      "Área <b>REDES Y ADS</b>.",
      "Una subtarea por comentario: slide, COPY o ARTE (con la imagen o el segundo) y lo que pidió el cliente.",
      "<b>Abrir slide</b>: lleva directo al slide que hay que corregir.",
    ], 75),
    f("e25-seguimiento", "Seguimiento de la revisión y atención de los ajustes", [
      "Resumen: ronda, avance, quién atiende copy y arte, y a quién se avisa.",
      "<b>Enviar al cliente</b> y cuántos ajustes van hechos.",
      "Los comentarios del cliente de la ronda en curso.",
      "<b>Copy</b>: corrígelo y guarda una <b>nueva versión</b> (la anterior queda para comparar).",
      "Marca <b>Ajuste hecho</b> (con una nota opcional para el cliente). Es lo mismo que marcar la subtarea en la tarea.",
    ]),
    { t: "bullets", x: [
      "Para el <b>arte</b>, sube el arte nuevo en «Arte nuevo» y presiona <b>Usar el arte nuevo</b>; hasta entonces el cliente sigue viendo el actual. Lo anterior queda en el historial.",
      "Puedes <b>reabrir</b> un slide aprobado si el cliente lo pide por WhatsApp: presiona <b>Reabrir</b> e indica el motivo.",
    ] },
    { t: "h3", x: "Devolver los ajustes al cliente" },
    { t: "p", x: "Al marcar la <b>última subtarea</b> aparece una ventana que sugiere <b>Enviar al cliente</b>. Tiene también el botón <b>Enviar por WhatsApp</b>, que <b>solo copia</b> el mensaje para que lo pegues en el grupo." },
    f("e27-enviar-cliente", "Ajustes listos", [
      "<b>Enviar por WhatsApp</b>: copia «¡Hola Equipo (cliente)! Los ajustes de COPY / ARTE de (título) están listos, puede revisarlo en el siguiente link: …».",
      "<b>Enviar al cliente</b>: la revisión pasa a la siguiente ronda y al cliente le llega un correo con la lista de lo ajustado.",
    ], 55),
    { t: "p", x: "En la ronda siguiente, el cliente ve <b>«Ver qué cambió»</b> en el copy (lo quitado y lo agregado resaltados), <b>«Ver el arte anterior»</b> y cada comentario suyo con la marca «Resuelto por el equipo». Puede aprobar o volver a comentar." },
    { t: "h3", x: "Aprobación, PDF y recordatorio" },
    { t: "bullets", x: [
      "Cuando el cliente aprueba <b>todos</b> los slides, la revisión pasa a <b>Aprobada</b> con quién aprobó y cuándo, y el equipo recibe aviso.",
      "En una revisión aprobada aparece <b>Descargar PDF resumen</b> (para el cliente y para el equipo): cada slide con su copy, miniaturas del arte (hasta 4 imágenes) y todos los comentarios por ronda con su resolución.",
      "Un día antes de la fecha límite (a partir de las 8:00) el cliente recibe un <b>recordatorio</b> por correo con lo que falta por aprobar.",
    ] },
    { t: "note", k: "info", x: "El TEAM 311 que atiende los ajustes puede abrir la revisión aunque no tenga el proyecto asignado. Quien no puede crear revisiones (TEAM 311) sí puede <b>editar los borradores</b> de sus proyectos." },
  ],
});

// ---------------------------------------------------------------- Finanzas (ADMIN)
const finanzas = {
  id: "finanzas",
  titulo: "Finanzas: cajas, DEV y reparto de los cobros",
  bloques: [
    { t: "p", x: "En <b>Administración › Finanzas › Resumen</b> ves el dinero del periodo y las <b>cajas de la empresa</b>. Solo lo ve el ADMINISTRADOR." },
    { t: "note", k: "info", x: "Los datos de las imágenes son de ejemplo, no son los reales de la empresa." },
    f("admin/a17-finanzas-cajas", "Finanzas › Resumen (datos de ejemplo)", [
      "Resumen del periodo: ingresos, egresos, balance y <b>dinero en cajas hoy</b> (no incluye DEV, que no es dinero de la empresa).",
      "<b>Cajas de la empresa</b>: una tarjeta por caja (Nómina, Ahorro, Navidad, Gastos y Utilidad), con su total y debajo lo que hay en efectivo y en banco. Muestran el saldo de <b>hoy</b>, sin importar el mes elegido.",
      "Toca una tarjeta para ver el <b>historial</b> de esa caja.",
    ]),
    { t: "h3", x: "Historial de una caja" },
    f("admin/a19-historial-caja", "Historial de la caja Nómina", [
      "Saldo de hoy y cambio en el periodo.", "Filtro por mes (o todo el historial).", "Cada entrada y salida: reparto de un cobro, gasto, traslado, retiro o préstamo, con la factura o recibo que la originó.",
    ], 85),
    { t: "h3", x: "Desarrollo (DEV)" },
    { t: "p", x: "DEV <b>no es una caja</b>: es el pago al desarrollador en los proyectos marcados como <b>software</b>. Tiene su propia tabla, <b>Desarrollo (DEV) · pagado en el periodo</b>, con el total y una fila por cada cobro de un proyecto de desarrollo (fecha, cobro, cliente, ingreso neto y el DEV separado). Sigue el mes elegido y no suma a «Dinero en cajas hoy». Sigue disponible en Movimientos para registrar los pagos al desarrollador." },
    f("admin/a18-dev", "Tabla de pagos a desarrollo", ["Total pagado a desarrollo en el periodo.", "Un renglón por cobro de proyecto de desarrollo."], 85),
    { t: "h3", x: "Cómo se reparte cada cobro" },
    { t: "p", x: "Al marcar una factura o recibo como pagado, su ingreso neto (sin IVA) se reparte automáticamente. El orden es: <b>con factura</b>: 1) impuestos (el IVA se divide aparte), 2) <b>30 % DEV</b> (solo proyectos de software), 3) Nómina, 4) Ahorro, 5) Navidad, 6) Gastos y 7) Utilidad. <b>Sin factura</b>: igual, sin el IVA." },
    { t: "p", x: "En un proyecto de <b>software</b>, lo que queda después de DEV se convierte en un <b>nuevo 100 %</b> y sobre él se calculan Nómina, Ahorro, Navidad y Gastos. Ejemplo con una factura de $116,000 (neto $100,000 + IVA $16,000) y los porcentajes actuales:" },
    { t: "table", head: ["Concepto", "Proyecto normal", "Proyecto de software"], rows: [
      ["IVA ($16,000)", "Impuestos $8,000 · Marketing $4,000 · Ganancia interna $4,000", "Igual"],
      ["DEV (30 %)", "$0", "$30,000"],
      ["Base para repartir", "$100,000", "$70,000 (lo que queda tras DEV)"],
      ["Nómina (45 %)", "$45,000", "$31,500"],
      ["Ahorro (3 %)", "$3,000", "$2,100"],
      ["Navidad (2 %)", "$2,000", "$1,400"],
      ["Gastos (10 %)", "$10,000", "$7,000"],
      ["Utilidad", "$40,000", "$28,000"],
      ["Cada socio (50 % de la utilidad)", "$20,000", "$14,000"],
    ] },
    { t: "note", k: "warn", x: "Cada cobro guarda el reparto con los porcentajes y la regla que tenía al cobrarse. Cambiar los porcentajes o la regla <b>no altera los cobros anteriores</b>. El botón «Cobros anteriores sin repartir» (en Porcentajes) reparte con la regla vigente." },
    { t: "h3", x: "Configurar los porcentajes" },
    { t: "p", x: "En <b>Finanzas › Porcentajes</b> están los porcentajes del reparto." },
    f("admin/a20-porcentajes", "Finanzas › Porcentajes (datos de ejemplo)", [
      "Nómina, Ahorro, Navidad y Gastos: se calculan sobre la base (el neto, o lo que queda tras DEV en software).",
      "<b>DEV</b>: solo proyectos de desarrollo; se descuenta primero.",
      "<b>Utilidad general</b>: se calcula sola (100 % menos Nómina, Ahorro, Navidad y Gastos); no se edita y cambia mientras modificas los demás porcentajes.",
      "<b>Para cada socio</b>: su parte de la utilidad, con lo que equivale sobre el ingreso neto.",
    ]),
  ],
};

// ---------------------------------------------------------------- Cambio de perfil (ADMIN)
const cambioPerfil = {
  id: "cambioperfil",
  titulo: "Cambio de perfil: dos cuentas con un solo clic",
  bloques: [
    { t: "p", x: "Si tienes <b>otra cuenta</b> en el portal (por ejemplo, una de EDITOR), puedes <b>vincularla</b> con tu cuenta de ADMINISTRADOR y pasar de una a otra con un botón, sin volver a iniciar sesión. Es una función solo del ADMINISTRADOR, y la otra cuenta puede ser de cualquier rol." },
    { t: "h3", x: "Vincular la otra cuenta" },
    { t: "steps", x: [
      "Entra a <b>Mi perfil</b> (tu nombre abajo en el menú) y baja a la sección <b>Cambio de perfil</b>.",
      "Escribe el <b>correo</b> <n>1</n> y la <b>contraseña</b> <n>2</n> de la otra cuenta. La contraseña solo sirve para comprobar que la cuenta es tuya; no se guarda.",
      "Presiona <b>Vincular cuenta</b> <n>3</n>.",
    ] },
    f("admin/a21-cambio-perfil", "Mi perfil › Cambio de perfil", ["Correo de la otra cuenta.", "Contraseña de esa cuenta.", "Vincular cuenta."], 85),
    { t: "h3", x: "Cambiar de cuenta" },
    { t: "p", x: "En el menú de la izquierda, arriba de «Cerrar sesión», aparece el botón <b>Cambiar a (nombre) · (rol)</b> <n>1</n>. Al presionarlo entras a esa cuenta; ahí aparece el mismo botón para regresar." },
    f("admin/a22-boton-cambiar", "Botón para cambiar de cuenta", ["Cambiar a la otra cuenta."], 38),
    { t: "bullets", x: [
      "Solo se puede vincular <b>una</b> cuenta. Para vincular otra, primero presiona <b>Desvincular cuenta</b> en la misma sección.",
      "Si el rol de la cuenta de ADMINISTRADOR cambia, el botón desaparece solo.",
      "Tras 5 intentos fallidos al vincular, se bloquea 15 minutos.",
    ] },
  ],
};

// ---------------------------------------------------------------- Bloques sueltos para secciones existentes
const proyectoDesdeReporte = [
  { t: "h3", x: "¿El proyecto no existe? Créalo desde aquí" },
  { t: "p", x: "Junto al selector de <b>Proyecto</b> hay un botón <b>+ Crear proyecto</b> <n>1</n> y un lápiz <n>2</n> para <b>editar</b> el proyecto elegido. Puedes crear proyectos de cualquier cliente sin salir de esta pantalla." },
  f("e15-nuevo-reporte-proyecto", "Nuevo reporte: crear o editar el proyecto", ["<b>Crear proyecto</b> del cliente elegido.", "<b>Editar</b> el proyecto elegido (nombre, responsable y correos)."], 85),
  { t: "steps", x: [
    "Elige primero el <b>cliente</b> y presiona <b>+ Crear proyecto</b>.",
    "Escribe el <b>nombre</b> del proyecto <n>1</n>. El <b>responsable</b> <n>2</n> es opcional.",
    "Revisa los <b>correos</b> <n>3</n>: vienen los del cliente; quita los que no apliquen o agrega otros (así el reporte se envía una sola vez a cada correo).",
    "Presiona <b>Crear proyecto</b> <n>4</n>: queda elegido y sigues llenando el reporte.",
  ] },
  f("e15b-crear-proyecto", "Crear proyecto sin salir del reporte", ["Nombre del proyecto.", "Responsable (opcional).", "Correos del proyecto.", "Crear proyecto."], 62),
  { t: "bullets", x: [
    "El lápiz edita el nombre, el responsable y los correos; los reportes anteriores muestran el nombre nuevo (folios y PDF ya enviados no cambian).",
    "No puede haber dos proyectos con el mismo nombre en un cliente.",
    "También puedes editar un proyecto en <b>Clientes y proyectos</b>: abre el detalle del cliente y presiona <b>Editar</b> junto al proyecto.",
    "El TEAM 311 no crea proyectos: solo elige los que tiene asignados.",
  ] },
];

const reordenar = [
  { t: "h3", x: "Cambiar el orden de las actividades" },
  { t: "p", x: "Cada actividad tiene a la izquierda un <b>asa ⋮⋮</b> <n>1</n>. Mantén presionada el asa y <b>arrastra</b> la actividad (con el mouse o con el dedo en iPad o celular); al soltarla, las actividades se <b>renumeran solas</b> (1, 2, 3…) y el orden se guarda al instante. Si el arrastre no funciona en tu dispositivo, usa las <b>flechas</b> <n>2</n> <n>3</n> para subir o bajar la actividad una posición." },
  f("e16-reordenar", "Actividades con asa y flechas para reordenar", ["Asa para arrastrar.", "Subir una posición.", "Bajar una posición."], 85),
  { t: "bullets", x: [
    "Mientras arrastras, las actividades se contraen para que sea fácil moverlas.",
    "Solo se puede reordenar un reporte <b>En proceso</b> o <b>Rechazado</b>; uno terminado o enviado queda bloqueado, igual que la edición.",
    "En el historial queda «Reordenó las actividades».",
  ] },
];

const pdfReporte = [
  { t: "h3", x: "Cómo es el PDF del reporte" },
  f("e17-pdf-reporte", "PDF del reporte: una sola hoja continua (datos de ejemplo)", [], 42),
  { t: "bullets", x: [
    "El PDF es <b>una sola hoja larga</b>, sin saltos de página, para que ninguna actividad se corte. (Si un reporte es larguísimo, se parte solo en hojas muy grandes.)",
    "Las <b>imágenes</b> salen como miniatura y, al hacer clic en ellas, abren el archivo completo en una pestaña nueva del navegador.",
    "Los <b>PDF y videos</b> adjuntos salen como un recuadro con su nombre («Abrir documento PDF», «Ver video») y también abren en una pestaña nueva.",
    "Esos enlaces <b>no piden iniciar sesión</b>: el cliente los abre directo desde el PDF. Son direcciones largas e imposibles de adivinar y no caducan; si se elimina la evidencia, el enlace deja de funcionar.",
    "Al final lleva el <b>pie</b> con el logo de 311, el correo y los teléfonos de contacto, el lema «Personas, procesos y tecnología en armonía.», el folio y el periodo.",
    "Aplica al PDF que ves, al que descargas y al que se envía por correo. Los PDF que ya se enviaron antes no cambian.",
  ] },
];

// ---------------------------------------------------------------- Aplicar a cada manual
const find = (secciones, id) => secciones.find((s) => s.id === id);
const afterBlock = (sec, test, blocks) => {
  const i = sec.bloques.findIndex(test);
  if (i < 0) throw new Error("No se encontró dónde insertar en " + sec.id);
  sec.bloques.splice(i + 1, 0, ...blocks);
};
const beforeBlock = (sec, test, blocks) => {
  const i = sec.bloques.findIndex(test);
  if (i < 0) throw new Error("No se encontró dónde insertar en " + sec.id);
  sec.bloques.splice(i, 0, ...blocks);
};
const insertSection = (secciones, beforeId, ...news) => {
  const i = secciones.findIndex((s) => s.id === beforeId);
  secciones.splice(i < 0 ? secciones.length : i, 0, ...news);
};
const addBullets = (sec, afterH3, items) => {
  const i = sec.bloques.findIndex((b) => b.t === "h3" && b.x.includes(afterH3));
  const b = sec.bloques[i + 2]?.t === "bullets" ? sec.bloques[i + 2] : sec.bloques[i + 1];
  if (b?.t !== "bullets") throw new Error("No hay lista en " + sec.id);
  b.x.push(...items);
};

export function aplicarE17(secciones, perfil) {
  if (perfil === "editor") {
    addBullets(find(secciones, "antes"), "Tu rol", [
      "Crear <b>proyectos</b> directamente desde «Nuevo reporte», <b>reordenar</b> arrastrando las actividades de un reporte y descargar un PDF en una sola hoja con sus adjuntos clickeables.",
      "Generar <b>recibos de pago, acuerdos de confidencialidad y contratos</b> (Administración › Documentos) y enviarlos por correo.",
      "Armar y dar seguimiento a las <b>revisiones de parrillas</b> de redes sociales que el cliente aprueba desde su panel.",
    ]);
    afterBlock(find(secciones, "crear"), (b) => b.t === "note" && b.k === "info" && b.x.includes("solo aparecen usuarios"), proyectoDesdeReporte);
    beforeBlock(find(secciones, "capturar"), (b) => b.t === "h3" && b.x === "Historial de cambios", reordenar);
    afterBlock(find(secciones, "enviar"), (b) => b.t === "fig" && b.f === "22-pdf", pdfReporte);
    insertSection(secciones, "baul", documentos(false), revisiones("editor"));
    const faq = find(secciones, "faq").bloques.find((b) => b.t === "faq");
    faq.items.push(
      ["El cliente no ve una revisión que armé.", "Si está en <b>Borrador</b> solo la ve el equipo. Presiona <b>Publicar al cliente</b>; el portal revisa que cada slide tenga copy y arte."],
      ["El cliente pide un cambio en un slide ya aprobado.", "Un slide aprobado se bloquea. Si el cliente lo pide por el grupo de WhatsApp, abre la revisión y presiona <b>Reabrir</b> en ese slide, con el motivo."],
      ["No puedo cambiar el orden de las actividades.", "Solo se reordenan reportes <b>En proceso</b> o <b>Rechazados</b>. Usa el asa ⋮⋮ o, si falla el arrastre, las flechas ↑ ↓."],
      ["No me deja enviar un documento.", "Marca la casilla «Lo leí y está correcto» y revisa que haya al menos un destinatario con un correo válido. Un documento ya enviado no se vuelve a enviar editado: duplícalo."],
      ["Los datos de la empresa faltan en un acuerdo o contrato.", "Los captura el ADMINISTRADOR en Documentos › Configuración. Avísale qué datos dice el portal que faltan."],
    );
    const res = find(secciones, "resumen").bloques.find((b) => b.t === "steps");
    res.x.splice(res.x.length - 2, 0,
      "Si hay una <b>revisión</b> con ajustes del cliente (globo rojo en «Revisiones»), atiende la tarea de ajustes, marca cada uno como hecho y presiona <b>Enviar al cliente</b>.",
    );
  }

  if (perfil === "admin") {
    addBullets(find(secciones, "antes"), "Qué puede hacer el ADMINISTRADOR", [
      "Ver las <b>cajas de la empresa</b>, el indicador de <b>DEV</b> y configurar el <b>reparto</b> de los cobros (incluida la utilidad general).",
      "<b>Vincular otra cuenta</b> tuya y cambiar de perfil con un botón, sin volver a iniciar sesión.",
      "Capturar los datos de la empresa para <b>Documentos</b> (acuerdos, contratos y recibos) y el contacto del pie de reportes y recibos.",
      "Armar y seguir las <b>Revisiones</b> de parrillas de redes sociales, igual que el EDITOR (ver el Manual del Editor).",
    ]);
    insertSection(secciones, "tareas", cambioPerfil);
    insertSection(secciones, "prestamos", finanzas);
    insertSection(secciones, "log", docConfig);
    const faq = find(secciones, "faq").bloques.find((b) => b.t === "faq");
    faq.items.push(
      ["En un proyecto de software la utilidad salió menor que en uno normal.", "Es lo esperado: primero se separa el 30 % de DEV y los porcentajes normales se aplican a lo que queda. Ver «Cómo se reparte cada cobro»."],
      ["Cambié los porcentajes y los cobros anteriores no cambiaron.", "Cada cobro guarda el reparto con el que se hizo. Los cambios aplican a los cobros que se registren desde ese momento."],
      ["DEV ya no aparece como una caja.", "Es un indicador: tiene su propia tabla en Finanzas › Resumen y no suma a «Dinero en cajas hoy»."],
      ["No me aparece el botón «Cambiar a…».", "Primero vincula la otra cuenta en Mi perfil › Cambio de perfil. El botón sale en el menú, arriba de «Cerrar sesión»."],
    );
    const res = find(secciones, "resumen").bloques.find((b) => b.t === "table");
    res.rows.splice(res.rows.length - 1, 0,
      ["Ver las cajas y el historial de una caja", "Administración › <b>Finanzas</b> › Resumen → toca la tarjeta de la caja."],
      ["Cambiar los porcentajes del reparto", "Finanzas › <b>Porcentajes</b> → edita y <b>Guardar porcentajes</b>."],
      ["Cambiar entre mis dos cuentas", "Mi perfil › Cambio de perfil → <b>Vincular cuenta</b>; luego el botón <b>Cambiar a…</b> del menú."],
      ["Capturar los datos de la empresa para documentos", "Administración › <b>Documentos</b> › <b>Configuración</b>."],
    );
  }

  if (perfil === "project") {
    addBullets(find(secciones, "antes"), "Tu perfil", [
      "Crear y dar seguimiento a las <b>revisiones de parrillas</b> de redes sociales que el cliente aprueba, y recibir sus ajustes como tareas.",
    ]);
    insertSection(secciones, "baul", revisiones("project"));
    const faq = find(secciones, "faq").bloques.find((b) => b.t === "faq");
    faq.items.push(["¿Dónde veo los ajustes que pide un cliente en una revisión?", "Llegan como una <b>tarea</b> («Ajustes · revisión · Ronda N») en el área REDES Y ADS, con una subtarea por comentario. Cada subtarea tiene «Abrir slide»."]);
  }
}
