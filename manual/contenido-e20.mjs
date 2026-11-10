// Contenido nuevo de los manuales (Evolutivo 20): nómina editable, ingresos directos a las cajas, reembolsos sin comprobante con
// «Aprobar y pagar» en un paso, y el tablero de tareas con «+» por columna, tarjetas contraíbles y columna de Borradores.
// Cada manual llama a aplicarE20(secciones, perfil) al final (después de aplicarE17). Bloques: ver build.mjs.

const find = (secciones, id) => secciones.find((s) => s.id === id);
const insertAfter = (secciones, id, ...news) => {
  const i = secciones.findIndex((s) => s.id === id);
  if (i < 0) throw new Error("No se encontró la sección " + id);
  secciones.splice(i + 1, 0, ...news);
};

// ---------------------------------------------------------------- Tareas (EDITOR, PROJECT 311 y ADMINISTRADOR)
const tareasE20 = (perfil) => ({
  id: "tablero-e20",
  titulo: "Tablero: botón «+», tarjetas contraídas y Borradores",
  bloques: [
    { t: "p", x: `Estas mejoras del tablero de <b>Tareas</b> son para ${perfil === "admin" ? "el ADMINISTRADOR, el EDITOR y PROJECT 311" : perfil === "editor" ? "ti (EDITOR), el ADMINISTRADOR y PROJECT 311" : "ti (PROJECT 311), el ADMINISTRADOR y el EDITOR"}. El TEAM 311 no ve el botón «+» ni la columna de Borradores.` },
    { t: "h3", x: "Crear una tarea desde una columna con «+»" },
    { t: "p", x: "En el encabezado de las columnas <b>PENDIENTE</b>, <b>EN PROCESO</b> y <b>PARA REVISAR</b> (y también en <b>BORRADORES</b>) hay un botón redondo con el signo <b>+</b>, junto al número de tareas. Al presionarlo se abre el mismo formulario de <b>Nueva tarea</b>, pero la tarea nace <b>en esa columna</b>. Sirve, por ejemplo, para registrar algo que ya está en proceso sin tener que arrastrarlo después." },
    { t: "steps", x: [
      "Presiona el <b>+</b> de la columna donde quieres que nazca la tarea.",
      "Llena el formulario como siempre (cliente, proyecto, personas, nombre y fecha de entrega) y presiona <b>Asignar tarea</b>.",
      "La tarea aparece en esa columna y las personas asignadas reciben su aviso, igual que con una tarea nueva.",
    ] },
    { t: "note", k: "info", x: "El botón «Nueva tarea» de la parte de arriba sigue funcionando igual: la tarea nace en PENDIENTE. No existe «+» en la columna TERMINADA, porque una tarea solo termina cuando se acepta." },
    { t: "h3", x: "Contraer una tarjeta para ahorrar espacio" },
    { t: "p", x: "Cada tarjeta tiene, en su esquina superior derecha, un icono para <b>contraerla</b>. La tarjeta contraída muestra solo lo esencial: la <b>foto de las personas asignadas</b>, el <b>nombre de la tarea</b> y la <b>fecha de vencimiento</b> (en rojo si ya venció y en naranja si vence en menos de 12 horas). Presiona el mismo icono para volver a <b>expandirla</b>." },
    { t: "bullets", x: [
      "Es <b>por tarjeta</b>: contraes solo las que quieras.",
      "El navegador <b>recuerda</b> cuáles dejaste contraídas, así que no se abren al recargar la página. Esta preferencia es de ese navegador: en otro dispositivo verás las tarjetas abiertas.",
      "Una tarjeta contraída se sigue abriendo con un clic y se puede arrastrar a otra columna como cualquier otra.",
    ] },
    { t: "h3", x: "La columna BORRADORES" },
    { t: "p", x: "A la izquierda de PENDIENTE hay una columna <b>✏️ BORRADORES</b>. Sirve para dejar tareas que todavía están incompletas y que aún <b>no quieres asignar al TEAM 311</b>. Un borrador <b>no avisa a nadie</b> y <b>el TEAM 311 no lo ve</b>, ni en el tablero, ni en el calendario, ni en las búsquedas. En cambio, el ADMINISTRADOR, el EDITOR y PROJECT 311 sí ven todos los borradores, no solo los que crearon." },
    { t: "steps", x: [
      "Presiona el <b>+</b> de la columna <b>BORRADORES</b>.",
      "Escribe el <b>nombre</b>, elige el <b>cliente</b> y el <b>proyecto</b> y la <b>fecha de entrega</b>: estos cuatro datos son <b>indispensables</b> aun para un borrador. El <b>área</b> y las <b>personas</b> puedes dejarlas vacías, y también la descripción, las subtareas y los recursos.",
      "Presiona <b>Crear borrador</b>. La tarjeta queda en la columna BORRADORES.",
    ] },
    { t: "h3", x: "Completar un borrador y mandarlo al equipo" },
    { t: "steps", x: [
      "Abre el borrador y presiona <b>Editar</b>. Completa el <b>área</b> y asigna a <b>al menos una persona</b>; agrega lo demás que necesites.",
      "Para seguir trabajándolo sin enviarlo, presiona <b>Guardar borrador</b>.",
      "Para mandarlo al equipo presiona <b>Enviar al equipo (Pendiente)</b>: la tarea pasa a PENDIENTE y las personas asignadas reciben su aviso por el portal, el navegador y correo, como en una tarea nueva. Si la tarea estaba programada para aparecer después, el aviso sale hasta esa fecha.",
    ] },
    { t: "note", k: "tip", x: "También puedes arrastrar el borrador a PENDIENTE (o usar «Mover a» dentro de la tarea). Si todavía le falta el área o la persona, el portal no lo mueve: te abre el borrador para que lo completes." },
    { t: "note", k: "warn", x: "Un borrador no cuenta en las métricas de Desempeño ni genera recordatorios de vencimiento hasta que se manda al equipo. Tampoco se puede encadenar a otra tarea mientras sea borrador." },
  ],
});

// ---------------------------------------------------------------- Finanzas (ADMINISTRADOR)
const finanzasE20 = {
  id: "finanzas-e20",
  titulo: "Finanzas: nómina, ingresos directos y reembolsos",
  bloques: [
    { t: "p", x: "En esta sección se explican tres partes de <b>Administración › Finanzas</b> que solo ve el ADMINISTRADOR: la <b>nómina semanal</b>, los <b>ingresos directos</b> a una caja y los <b>reembolsos</b> del equipo." },
    { t: "note", k: "info", x: "Esta sección no lleva imágenes todavía: describe las pantallas con sus nombres exactos para que las ubiques en el portal." },

    { t: "h3", x: "Nómina semanal y cómo editarla" },
    { t: "p", x: "En <b>Finanzas › Nómina</b> hay una tarjeta por semana del año. Se paga a más tardar el <b>sábado</b>, de la caja <b>Nómina</b> (efectivo y/o banco). Cada semana está <b>PROGRAMADA</b> hasta que la marcas como <b>PAGADA</b>. El desglose por persona sale de los <b>sueldos semanales</b> (botón «Sueldos semanales» o el perfil de cada usuario)." },
    { t: "p", x: "Mientras una semana siga <b>PROGRAMADA</b> la puedes <b>editar</b> sin tocar los sueldos generales:" },
    { t: "steps", x: [
      "En la tarjeta de la semana presiona <b>Editar nómina</b>.",
      "Cambia el <b>sueldo de cada persona</b> para esa semana. Con <b>Quitar</b> sacas a alguien solo de esa semana y con <b>Agregar persona solo a esta semana</b> sumas a quien no cobra nómina normalmente.",
      "Si hay un bono o un descuento, escríbelo en <b>Ajuste</b> (por ejemplo <b>+500</b> o <b>-250</b>) y anota el <b>motivo</b>. Debajo ves el total con el ajuste.",
      "Presiona <b>Guardar cambios</b>.",
    ] },
    { t: "bullets", x: [
      "Una semana editada muestra la etiqueta <b>Editada</b> y <b>deja de actualizarse sola</b> cuando cambias los sueldos generales; las demás semanas PROGRAMADAS sí se actualizan.",
      "<b>Restablecer a los sueldos vigentes</b> (dentro de la misma ventana) quita la edición: la semana vuelve a usar los sueldos actuales y sin ajuste.",
      "Al presionar <b>Marcar como PAGADA</b> el ajuste que ya capturaste aparece cargado; revisa la caja y cómo se divide entre efectivo y banco, y confirma.",
      "Una semana <b>PAGADA</b> no se edita. Si necesitas corregirla, presiona <b>Anular pago</b> (con motivo): el dinero regresa a la caja Nómina y la semana vuelve a PROGRAMADA; entonces ya puedes editarla.",
    ] },

    { t: "h3", x: "Ingresos directos a una caja" },
    { t: "p", x: "Un <b>ingreso directo</b> es dinero que entra a una caja <b>sin pasar por el reparto de un cobro</b>: no se le aplican los porcentajes ni las deducciones, y suma completo a la caja. Sirve, por ejemplo, para rendimientos del banco, la aportación de un socio o un reembolso que le hacen a la empresa. Se puede registrar en las cajas <b>Ahorro</b>, <b>Navidad</b>, <b>Gastos</b>, <b>Utilidad</b> e <b>Impuestos</b>." },
    { t: "steps", x: [
      "En <b>Finanzas › Resumen</b> toca la tarjeta de la caja (para <b>Impuestos</b>, presiona su nombre en la tabla «Cajas del IVA») para abrir su <b>historial</b>.",
      "En el recuadro <b>Registrar ingreso directo</b> escribe el <b>concepto</b>, el <b>motivo del ingreso</b>, el <b>monto</b> y la <b>fecha</b>.",
      "Elige si entra como <b>Banco</b> o <b>Efectivo</b>.",
      "En <b>Procedencia</b> elige <b>Cliente / proyecto</b> (el cliente y el proyecto son <b>opcionales</b>) u <b>Otro</b>; con «Otro» debes escribir de dónde viene el dinero.",
      "Presiona <b>Registrar ingreso</b>. El saldo de la caja sube de inmediato.",
    ] },
    { t: "bullets", x: [
      "Cada ingreso queda en la lista <b>Ingresos directos registrados</b> del historial de la caja, con su concepto, motivo, procedencia, tipo de dinero, monto y quién lo registró.",
      "También aparece en el historial como <b>Ingreso directo</b> y cuenta en <b>Ingresos del periodo</b> de Finanzas › Resumen (en el detalle verás «Directos») y en la exportación a Excel.",
      "<b>Anular</b> un ingreso (con motivo) regresa el dinero: sale otra vez de la caja y el registro queda marcado como anulado. Si la caja ya no tiene ese saldo, el portal no te deja anularlo.",
    ] },

    { t: "h3", x: "Reembolsos: aprobar y pagar en un solo paso" },
    { t: "p", x: "Un <b>reembolso</b> es dinero que una persona del TEAM 311 puso de su bolsillo para la empresa. La persona lo solicita en <b>Reembolsos</b> con el concepto, el monto, la fecha del gasto y cuándo necesita que se le devuelva. El <b>comprobante</b> (foto o PDF) es <b>opcional</b>: si no lo adjunta, el reembolso lleva la etiqueta naranja <b>Sin comprobante</b> para que lo tomes en cuenta al decidir." },
    { t: "steps", x: [
      "Entra a <b>Reembolsos</b>. Por defecto ves los <b>Solicitados</b>; el ADMINISTRADOR recibe un aviso cuando llega uno nuevo.",
      "Revisa el concepto, el monto y, si lo hay, el comprobante (<b>Ver comprobante</b>).",
      "Presiona <b>Aprobar y pagar</b>. Se abre una ventana donde eliges la <b>caja de la que sale</b> el dinero y si se paga en <b>efectivo</b>, <b>banco</b> o <b>combinado</b>. El monto es el que se solicitó y <b>no se puede modificar</b>.",
      "Presiona <b>Aprobar y registrar el egreso</b>. El reembolso pasa a <b>PAGADO</b> y la persona recibe el aviso «¡Te pagaron tu reembolso!».",
    ] },
    { t: "bullets", x: [
      "El pago se registra como un <b>egreso</b> (gasto) de la caja elegida: <b>resta</b> de su saldo y aparece en Gastos y en los egresos del periodo.",
      "Si la caja no tiene saldo suficiente en efectivo o banco, el portal <b>no deja pagar</b> y te lo explica; elige otra caja o traslada dinero primero.",
      "<b>Rechazar</b> sigue disponible, con motivo obligatorio: no se mueve dinero y la persona recibe el motivo.",
      "Los reembolsos que ya estaban <b>Aprobados</b> antes de este cambio conservan el botón <b>Registrar pago</b>.",
    ] },
    { t: "note", k: "tip", x: "Si el dinero ya salió de la empresa por otra vía (por ejemplo una transferencia directa), igual elige la caja de donde se descontó: el objetivo es que el saldo de las cajas siempre refleje la realidad." },
  ],
};

export function aplicarE20(secciones, perfil) {
  // Tablero de tareas: se ubica justo después de la sección de tareas de cada manual
  insertAfter(secciones, "tareas", tareasE20(perfil));

  if (perfil === "admin") {
    insertAfter(secciones, "finanzas", finanzasE20);
    const res = find(secciones, "resumen")?.bloques.find((b) => b.t === "table");
    if (res) {
      res.rows.splice(res.rows.length - 1, 0,
        ["Editar la nómina de una semana", "Finanzas › <b>Nómina</b> → <b>Editar nómina</b> → sueldos, ajuste y motivo → Guardar cambios."],
        ["Registrar un ingreso directo a una caja", "Finanzas › Resumen → tarjeta de la caja → <b>Registrar ingreso directo</b>."],
        ["Aprobar y pagar un reembolso", "<b>Reembolsos</b> → <b>Aprobar y pagar</b> → caja y efectivo o banco → Aprobar y registrar el egreso."],
      );
    }
    const faq = find(secciones, "faq")?.bloques.find((b) => b.t === "faq");
    faq?.items.push(
      ["Edité una semana de nómina y los sueldos nuevos no le llegan.", "Es lo esperado: una semana <b>Editada</b> ya no se actualiza sola. Usa <b>Restablecer a los sueldos vigentes</b> dentro de «Editar nómina»."],
      ["No puedo editar una semana de nómina.", "Está <b>PAGADA</b>. Presiona <b>Anular pago</b> (con motivo) y después edítala."],
      ["No puedo registrar un ingreso directo en la caja Nómina.", "Los ingresos directos aplican solo a Ahorro, Navidad, Gastos, Utilidad e Impuestos."],
      ["Un reembolso no se deja pagar.", "La caja elegida no tiene saldo suficiente en efectivo o banco. Elige otra caja o haz un traslado en Finanzas › Movimientos."],
    );
  }

  if (perfil === "project" || perfil === "editor") {
    const res = find(secciones, "resumen")?.bloques.find((b) => b.t === "table");
    if (res) {
      res.rows.splice(res.rows.length - 1, 0,
        ["Crear una tarea en una columna", "Tareas → botón <b>+</b> del encabezado de la columna."],
        ["Guardar una tarea incompleta", "Botón <b>+</b> de la columna <b>BORRADORES</b> → nombre, cliente, proyecto y fecha → Crear borrador."],
        ["Mandar un borrador al equipo", "Abrir el borrador → <b>Editar</b> → área y personas → <b>Enviar al equipo (Pendiente)</b>."],
        ["Contraer una tarjeta", "Icono de la esquina de la tarjeta; vuelve a presionarlo para expandirla."],
      );
    }
  }
}
