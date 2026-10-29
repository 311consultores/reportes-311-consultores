// Textos de los documentos. Las cláusulas fijas son las de los archivos de 311 Consultores / TRIADA; solo cambian los campos capturados.
import { cleanText, dateCompact, dateLong, moneyWords, money, ordinal, plural, rich, safeFileName, spellRfc, type DocBlock, type TextDoc } from "@/lib/docs/text";
import type { AcuerdoData, Empresa, RepLegal, ClienteDoc, ReciboData } from "@/lib/docs/types";

const p = (s: string, align: "j" | "l" | "r" | "c" = "j"): DocBlock => ({ k: "p", r: rich(cleanText(s)), align });
const h = (s: string): DocBlock => ({ k: "h", r: rich(cleanText(s)) });
const li = (mark: string, s: string): DocBlock => ({ k: "li", mark, r: rich(cleanText(s)) });
const center = (t: string): DocBlock => ({ k: "center", t, b: true });

/** Primer párrafo de las partes: la empresa (igual en todos los documentos). */
export const parteEmpresa = (e: Empresa) =>
  `De una parte, **${e.razonSocial}**, sociedad legalmente constituida conforme a las leyes de este país, con domicilio social en ${e.domicilio} inscrita en la Secretaría de Administración Tributaria con Registro Federal de Contribuyentes ${e.rfc.toUpperCase()} (${spellRfc(e.rfc)}); en adelante **LA EMPRESA**, representada en este acto por **${e.repNombre.toUpperCase()}**, mayor de edad, con domicilio en ${e.repDomicilio} y provisto de INE identificada por el número ${e.repIne}, en adelante **EL REPRESENTANTE DE LA EMPRESA**.`;

/** Segundo párrafo de las partes: el cliente y su representante legal. */
export const parteCliente = (c: ClienteDoc, r: RepLegal) =>
  `De otra parte, **${c.razon}**${c.domicilio.trim() ? `, con domicilio social en ${c.domicilio.trim()}` : ""}, en adelante **EL CLIENTE**, representada en este acto por **${r.nombre.toUpperCase()}**, con domicilio en ${r.domicilio}, con Clave Única de Registro de Población CURP ${r.curp.toUpperCase()}, mayor de edad y provisto de INE con clave de elector ${r.ine.toUpperCase()}.`;

/** Bloque de firmas: la empresa a la izquierda y el cliente a la derecha. */
export const firmas = (empresa: Empresa, cargo: string, rep: RepLegal, cliente: ClienteDoc): DocBlock => ({
  k: "sign",
  cols: [
    { lines: [empresa.razonSocial, `${cargo} – ${empresa.repNombre}`, "___________________________"] },
    { lines: [cliente.razon, rep.nombre.toUpperCase(), rep.rol || "Representante Legal", "___________________________"] },
  ],
});

/** Cláusula adicional de texto libre (antes de las firmas). */
const extraClause = (n: number, x: { titulo: string; texto: string }): DocBlock[] => [
  h(`${ordinal(n)}. - ${x.titulo.trim() || "Cláusula adicional"}`),
  ...x.texto.split(/\n{1,}/).map((t) => t.trim()).filter(Boolean).map((t) => p(t)),
];

// ---------- Acuerdo de confidencialidad ----------
export function acuerdoDoc(d: AcuerdoData): TextDoc {
  const lugar = d.empresa.ciudad.trim();
  const fecha = `En ${lugar} a ${dateLong(d.fecha)}`;
  const pena = `${money(d.penaCents)} (${moneyWords(d.penaCents)})`;
  const duracion = (parte: string, parteTxt: string) =>
    `El presente Acuerdo tendrá una duración de ${plural(d.meses, "mes", "meses")} a partir de la fecha de su firma. No obstante, ${parteTxt} estará obligado a mantener la confidencialidad de la Información Confidencial durante un período de ${plural(d.anios, "año adicional", "años adicionales")} después de la terminación del presente, independientemente de las causas en que se dé por concluida la misma y ambas pactan como pena convencional en caso de incumplimiento por parte de ${parte} la cantidad de ${pena} en caso de incumplimiento de este.`;

  const blocks: DocBlock[] = [
    { k: "p", r: rich(cleanText(fecha)), align: "r" },
    center("REUNIDOS"),
    p(parteEmpresa(d.empresa)),
    p(parteCliente(d.cliente, d.rep)),
    p(`Este Acuerdo de No Divulgación (que mencionaremos como, el "Acuerdo") se celebra con el propósito de establecer los términos y condiciones bajo los cuales LA EMPRESA y EL CLIENTE acuerdan proteger la información confidencial y los datos personales intercambiados entre ambas partes en el curso de sus relaciones comerciales.`),
    center("INTERVIENEN"),
    p(`Ambas partes en su propio nombre y derecho, reconociéndose mutuamente capacidad legal suficiente para el otorgamiento del presente ACUERDO DE CONFIDENCIALIDAD Y NO DIVULGACIÓN (en adelante, el "Acuerdo"), y EXPONEN`),
    p(`I. Que EL CLIENTE y LA EMPRESA desean establecer una relación comercial basada en la confianza y la confidencialidad, en la que LA EMPRESA podrá compartir con EL CLIENTE cierta información confidencial (en adelante, la "Información Confidencial").`),
    p(`II. Que EL CLIENTE reconoce que la Información Confidencial es propiedad exclusiva de LA EMPRESA y tiene un gran valor comercial.`),
    p(`III. Que EL CLIENTE desea mantener la Información Confidencial en estricta privacidad y protegerla de cualquier divulgación no autorizada.`),
    center("POR LO TANTO, AMBAS PARTES ACUERDAN"),

    h("PRIMERA. - Objeto del Acuerdo."),
    p(`El objeto del presente Acuerdo es establecer los términos y condiciones en los que LA EMPRESA podrá compartir Información Confidencial con EL CLIENTE, y en los que EL CLIENTE se compromete a mantener dicha Información Confidencial en estricta confidencialidad.`),

    h("SEGUNDA. - Definición de Información Confidencial."),
    p(`A los efectos del presente Acuerdo, se entenderá por Información Confidencial cualquier información que LA EMPRESA comunique a EL CLIENTE, ya sea de forma oral, escrita, visual o en cualquier otro formato electrónico, y que esté marcada como confidencial o que, por su naturaleza, pueda razonablemente considerarse como tal. La Información Confidencial podrá incluir, entre otros:`),
    li("•", "Información técnica, comercial o financiera."),
    li("•", "Planes de negocio, estrategias de marketing y proyectos de investigación y desarrollo."),
    li("•", "Listas de clientes, proveedores y empleados."),
    li("•", "Cualquier otra información que LA EMPRESA designe como confidencial."),

    h("TERCERA. - Obligaciones de LA EMPRESA"),
    p("LA EMPRESA se compromete a:"),
    li("a)", "Proteger los datos personales de los clientes con el más alto grado de confidencialidad y seguridad, cumpliendo con todas las leyes y regulaciones aplicables en materia de protección de datos personales."),
    li("b)", "Utilizar la Información Confidencial exclusivamente para los fines establecidos en el marco de las relaciones comerciales con EL CLIENTE y no para ningún otro propósito sin el consentimiento previo y por escrito de EL CLIENTE."),
    li("c)", "Implementar medidas razonables para proteger la Información Confidencial contra el acceso no autorizado, la divulgación, la pérdida o el uso indebido."),
    li("d)", "Informar a EL CLIENTE de inmediato en caso de cualquier acceso no autorizado a la Información Confidencial o cualquier otra violación de las obligaciones establecidas en este Acuerdo."),

    h("CUARTA. - Obligaciones de EL CLIENTE."),
    p("EL CLIENTE se compromete a:"),
    li("•", "Mantener la Información Confidencial en estricta confidencialidad y no divulgar a ningún tercero sin el consentimiento previo y por escrito de LA EMPRESA."),
    li("•", "Utilizar la Información Confidencial únicamente para los fines previstos en el presente Acuerdo y no para ningún otro propósito."),
    li("•", "No reproducir, copiar, traducir ni crear obras derivadas de la Información Confidencial sin el consentimiento previo y por escrito de LA EMPRESA."),
    li("•", "Tomar todas las medidas razonables para proteger la Información Confidencial de cualquier divulgación no autorizada."),
    li("•", "Notificar inmediatamente a LA EMPRESA de cualquier conocimiento o sospecha de divulgación no autorizada de la Información Confidencial."),
    li("•", "Devolver a LA EMPRESA toda la Información Confidencial y cualquier copia de esta en su poder o bajo su control, una vez que el presente Acuerdo haya terminado o a petición de LA EMPRESA."),

    h("QUINTA. - Excepciones."),
    p("La obligación de confidencialidad de EL CLIENTE no se aplicará a:"),
    li("•", "Información que sea de conocimiento público en el momento de su divulgación por parte de LA EMPRESA."),
    li("•", "Información que haya sido legítimamente obtenida por EL CLIENTE de un tercero sin restricción de confidencialidad."),
    li("•", "Información que haya sido desarrollada de forma independiente por EL CLIENTE sin utilizar la Información Confidencial de LA EMPRESA."),
    li("•", "Información que sea requerida por ley o por un tribunal competente para ser divulgada."),
    li("•", "O cualquier otra información que pueda tipificarse como un delito previsto en el código penal del estado de Yucatán o el código penal federal."),

    h("SEXTA. - Duración."),
    p(duracion('"EL CLIENTE"', "EL CLIENTE")),
    p("Por otra parte:"),
    p(duracion("LA EMPRESA", "LA EMPRESA")),

    h("SÉPTIMA. - Devolución de Información"),
    p("A la terminación de este Acuerdo o a solicitud de una de las partes, EL CLIENTE deberá devolver o destruir toda la Información Confidencial que haya recibido de la otra parte, excepto en la medida en que la ley exija su conservación."),

    h("OCTAVA. - Ley Aplicable y Jurisdicción"),
    p(`Este Acuerdo se regirá e interpretará de acuerdo con las leyes de México, y cualquier disputa relacionada con este Acuerdo será sometida a la jurisdicción de los tribunales competentes de la ciudad de ${lugar.split(",")[0].trim()}, ${lugar.split(",").slice(1).join(",").trim() || "México"}.`),
    p("**DECLARA “AL CLIENTE”:**"),
    p("1.- Que se encuentra unido contractualmente con LA EMPRESA en una relación comercial en virtud de la cual tiene acceso a información confidencial y de interés patrimonial, tanto de LA EMPRESA como de la del “CLIENTE” de este último."),
    p("2.- Que en consecuencia tiene la obligación ineludible e inexcusable de guardar secreto y confidencialidad en la información a que tiene acceso, así como de proteger y salvaguardar la propiedad industrial, información confidencial, patentes de invención, registros de modelos de utilidad, diseños industriales, marcas, marcas colectivas, avisos comerciales, nombres comerciales, logos, avisos comerciales, publicaciones, denominaciones sociales, presupuestos, cotizaciones o propuestas económicas y en general los secretos industriales y correspondencia propiedad de su “CLIENTE” y de “LA EMPRESA”."),
    p("3.- Que en todo caso de una disputa se procederá a una denuncia formal como se tiene previsto en el Código Penal Federal tiene previstos que cito a continuación en los siguientes artículos:"),
    p("Artículo 210.- Se impondrán de treinta a doscientas jornadas de trabajo en favor de la comunidad, al que, sin justa causa, con perjuicio de alguien y sin consentimiento del que pueda resultar perjudicado, revele algún secreto o comunicación reservada que conoce o ha recibido con motivo de su empleo, cargo o puesto."),
    p("Artículo 211.- La sanción será de uno a cinco años, multa de cincuenta a quinientos pesos y suspensión de profesión en su caso, de dos meses a un año, cuando la revelación punible sea hecha por persona que presta servicios profesionales o técnicos o por funcionario o empleado público o cuando el secreto revelado o publicado sea de carácter industrial."),
    p("Artículo 211 Bis. - A quien revele, divulgue o utilice indebidamente o en perjuicio de otro, información o imágenes obtenidas en una intervención de comunicación privada, se le aplicarán sanciones de seis a doce años de prisión y de trescientos a seiscientos días multa."),

    h("NOVENA. – Modificación"),
    p("Ambas partes acuerdan que cualquier modificación al convenio se practicará de manera escrita previo consentimiento de las partes, el cual deberá ser firmado por ambos contrayentes ya que en caso contrario lo establecido en este presente convenio, será lo único válido en cualquier tiempo."),

    h("DÉCIMA. - Acuerdo Completo"),
    p("Este Acuerdo constituye el acuerdo completo entre las partes con respecto a su objeto y sustituye todos los acuerdos y entendimientos previos, ya sean orales o escritos, en relación con el mismo."),
  ];

  if (d.extra && d.extra.texto.trim()) blocks.push(...extraClause(11, d.extra));

  blocks.push(
    { k: "p", r: rich(cleanText(fecha)), align: "r" },
    { k: "space", h: 6 },
    firmas(d.empresa, d.cargoEmpresa, d.rep, d.cliente),
  );
  return { title: "ACUERDO DE CONFIDENCIALIDAD Y NO DIVULGACIÓN", blocks };
}

// ---------- Nombres de archivo y correos ----------
export const acuerdoFileName = (cliente: string, fecha: string) => safeFileName(`ACUERDO DE CONFIDENCIALIDAD Y NO DIVULGACIÓN - ${cliente} ${dateCompact(fecha)}`);
export const reciboFileName = (folio: string, cliente: string, fecha: string) => safeFileName(`Recibo de Pago ${folio} - ${cliente} ${dateCompact(fecha)}`);
export const contratoFileName = (cliente: string, fecha: string) => safeFileName(`CONTRATO DE PRESTACIÓN DE SERVICIOS - ${cliente} ${dateCompact(fecha)}`);

export function defaultEmail(kind: "RECIBO" | "ACUERDO" | "CONTRATO", ctx: { cliente: string; folio?: string | null }): { subject: string; body: string } {
  if (kind === "RECIBO") {
    return {
      subject: `Recibo de pago ${ctx.folio ?? ""} - 311 Consultores`.replace(/\s+/g, " ").trim(),
      body: `Hola, buen día.\n\nTe comparto el recibo de pago ${ctx.folio ?? ""} correspondiente a tu pago. Queda adjunto en PDF.\n\nQuedamos atentos a cualquier duda.\n\nSaludos cordiales,\n311 Consultores`.replace(/ \./g, "."),
    };
  }
  if (kind === "ACUERDO") {
    return {
      subject: `Acuerdo de confidencialidad y no divulgación - ${ctx.cliente}`,
      body: `Hola, buen día.\n\nTe comparto el Acuerdo de Confidencialidad y No Divulgación para su lectura y firma. Queda adjunto en PDF.\n\nCuando lo tengas firmado, por favor envíanos una copia por este medio.\n\nSaludos cordiales,\n311 Consultores`,
    };
  }
  return {
    subject: `Contrato de prestación de servicios profesionales - ${ctx.cliente}`,
    body: `Hola, buen día.\n\nTe comparto el Contrato de Prestación de Servicios Profesionales para su lectura y firma. Queda adjunto en PDF.\n\nCuando lo tengas firmado, por favor envíanos una copia por este medio.\n\nSaludos cordiales,\n311 Consultores`,
  };
}

// ---------- Recibo ----------
export type ReciboView = {
  folio: string;
  fecha: string;
  clienteNombre: string;
  clienteEmpresa: string;
  conceptos: { desc: string; cents: number }[];
  total: number;
  recibe: string;
};

export const reciboView = (d: ReciboData, folio: string): ReciboView => ({
  folio, fecha: d.fecha, clienteNombre: d.clienteNombre, clienteEmpresa: d.clienteEmpresa, conceptos: d.conceptos,
  total: d.conceptos.reduce((s, c) => s + c.cents, 0), recibe: d.recibe,
});
