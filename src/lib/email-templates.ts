const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const AVISO_PRIVACIDAD =
  "Los datos personales contenidos en este mensaje y sus anexos están protegidos conforme a nuestra Política de Privacidad. " +
  "311 Consultores es responsable del tratamiento de sus datos con la finalidad de mantener la relación comercial y profesional. " +
  "Usted puede ejercer sus derechos de acceso, rectificación, cancelación u oposición enviando un correo a admon@311consultores.com";

const AVISO_CONFIDENCIALIDAD =
  "Confidencialidad: Este mensaje es privado y confidencial. Si usted no es el destinatario original, por favor notifíquelo " +
  "al remitente y elimine el mensaje de su sistema inmediatamente.";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function button(href: string, label: string) {
  return `<a href="${esc(href)}" style="display:inline-block;background:#007AFF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:12px;">${esc(label)}</a>`;
}

function shell(inner: string, withLogo: boolean) {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#F5F5F7;font-family:${FONT};color:#1d1d1f;">
<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;line-height:1.55;font-size:15px;">
${withLogo ? `<p style="margin:0 0 24px;"><img src="cid:logo311" alt="311 Consultores" style="max-height:56px;max-width:220px;"></p>` : ""}
${inner}
</div></body></html>`;
}

export function reportEmail(p: {
  clientName: string;
  folio: string;
  projectName: string;
  startDate: string;
  endDate: string;
  link: string;
  phrase: string;
  withLogo: boolean;
}) {
  const subject = `Reporte de actividades ${p.folio} — ${p.projectName}`;

  const text = [
    `Hola Equipo ${p.clientName},`,
    "",
    `A continuación les compartimos como archivo adjunto el Reporte de Actividades ${p.folio} del proyecto: ${p.projectName} que corresponde al período del: ${p.startDate} al ${p.endDate}`,
    "",
    "Igualmente si lo desean pueden dar click al botón de abajo para verlo en un panel de acceso exclusivo para ustedes:",
    p.link,
    "",
    "El correo y contraseña de acceso se los compartirá Leslie López nuestra asistente.",
    "",
    "Les deseamos éxito en sus actividades.",
    "",
    "Saludos cordiales.",
    "Atentamente Equipo 311.",
    "",
    p.phrase,
    "",
    AVISO_PRIVACIDAD,
    "",
    AVISO_CONFIDENCIALIDAD,
  ].join("\n");

  const html = shell(
    `<p style="margin:0 0 16px;">Hola Equipo <strong>${esc(p.clientName)}</strong>,</p>
<p style="margin:0 0 16px;">A continuación les compartimos como archivo adjunto el Reporte de Actividades <strong>${esc(p.folio)}</strong> del proyecto: <strong>${esc(p.projectName)}</strong> que corresponde al período del: <strong>${esc(p.startDate)}</strong> al <strong>${esc(p.endDate)}</strong></p>
<p style="margin:0 0 20px;">Igualmente si lo desean pueden dar click al botón de abajo para verlo en un panel de acceso exclusivo para ustedes:</p>
<p style="margin:0 0 24px;">${button(p.link, "Ver reporte")}</p>
<p style="margin:0 0 16px;">El correo y contraseña de acceso se los compartirá Leslie López nuestra asistente.</p>
<p style="margin:0 0 16px;">Les deseamos éxito en sus actividades.</p>
<p style="margin:0 0 4px;">Saludos cordiales.</p>
<p style="margin:0 0 20px;"><strong>Atentamente Equipo 311.</strong></p>
<p style="margin:0 0 24px;color:#515154;font-style:italic;">${esc(p.phrase)}</p>
<hr style="border:none;border-top:1px solid #e5e5ea;margin:0 0 16px;">
<p style="margin:0 0 10px;font-size:12px;color:#86868b;">${esc(AVISO_PRIVACIDAD)}</p>
<p style="margin:0;font-size:12px;color:#86868b;">${esc(AVISO_CONFIDENCIALIDAD)}</p>`,
    p.withLogo,
  );

  return { subject, text, html };
}

/** Aviso interno: llegó un registro de cliente nuevo. */
export function registroNuevoEmail(p: {
  companyName: string;
  contactName: string;
  contactEmail: string;
  requiresInvoice: boolean;
  link: string;
  withLogo: boolean;
}) {
  const subject = `Nuevo registro de cliente: ${p.companyName}`;
  const text = [
    "Llegó un nuevo registro de cliente por el formulario público.",
    "",
    `Empresa: ${p.companyName}`,
    `Contacto: ${p.contactName} (${p.contactEmail})`,
    `Requiere factura: ${p.requiresInvoice ? "Sí" : "No"}`,
    "",
    "Revísalo y apruébalo aquí:",
    p.link,
  ].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;">Llegó un <strong>nuevo registro de cliente</strong> por el formulario público.</p>
<table style="margin:0 0 20px;font-size:14px;border-collapse:collapse;">
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Empresa</td><td><strong>${esc(p.companyName)}</strong></td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Contacto</td><td>${esc(p.contactName)} (${esc(p.contactEmail)})</td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Requiere factura</td><td>${p.requiresInvoice ? "Sí" : "No"}</td></tr>
</table>
<p style="margin:0 0 8px;">${button(p.link, "Revisar registro")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}

/** Confirmación para quien se registró. */
export function registroConfirmacionEmail(p: { contactName: string; companyName: string; withLogo: boolean }) {
  const subject = "Recibimos tu registro — 311 Consultores";
  const text = [
    `Hola ${p.contactName},`,
    "",
    `Recibimos el registro de ${p.companyName}. Nuestro equipo lo revisará y, si necesitamos algo más, te contactaremos.`,
    "",
    "Gracias por confiar en nosotros.",
    "Atentamente Equipo 311.",
    "",
    "Si tienes dudas, escríbenos a admon@311consultores.com",
    "",
    AVISO_PRIVACIDAD,
  ].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;">Hola <strong>${esc(p.contactName)}</strong>,</p>
<p style="margin:0 0 16px;">Recibimos el registro de <strong>${esc(p.companyName)}</strong>. Nuestro equipo lo revisará y, si necesitamos algo más, te contactaremos.</p>
<p style="margin:0 0 4px;">Gracias por confiar en nosotros.</p>
<p style="margin:0 0 20px;"><strong>Atentamente Equipo 311.</strong></p>
<p style="margin:0 0 16px;font-size:13px;color:#515154;">Si tienes dudas, escríbenos a admon@311consultores.com</p>
<hr style="border:none;border-top:1px solid #e5e5ea;margin:0 0 16px;">
<p style="margin:0;font-size:12px;color:#86868b;">${esc(AVISO_PRIVACIDAD)}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}

/** Aviso para Administración: un TEAM 311 terminó un reporte y espera revisión. */
export function reporteTerminadoEmail(p: { folio: string; clientName: string; projectName: string; teamName: string; link: string; withLogo: boolean }) {
  const subject = `Reporte ${p.folio} terminado por ${p.teamName} — listo para revisión`;
  const text = [
    `${p.teamName} marcó como terminado el reporte ${p.folio}.`,
    "",
    `Cliente: ${p.clientName}`,
    `Proyecto: ${p.projectName}`,
    "",
    "Revísalo y apruébalo o recházalo aquí:",
    p.link,
  ].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;"><strong>${esc(p.teamName)}</strong> marcó como <strong>terminado</strong> el reporte <strong>${esc(p.folio)}</strong> y está listo para revisión.</p>
<table style="margin:0 0 20px;font-size:14px;border-collapse:collapse;">
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Cliente</td><td>${esc(p.clientName)}</td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Proyecto</td><td>${esc(p.projectName)}</td></tr>
</table>
<p style="margin:0 0 8px;">${button(p.link, "Revisar reporte")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}

export type OverdueItem = { client: string; kind: string; number: string | null; description: string; total: string; dueDate: string; daysLate: number };

/** Aviso diario para Administración: lista de facturas y recibos vencidos. */
export function facturasVencidasEmail(p: { items: OverdueItem[]; total: string; link: string; withLogo: boolean }) {
  const n = p.items.length;
  const subject = `${n === 1 ? "1 factura vencida" : `${n} facturas vencidas`} por ${p.total} — seguimiento de cobro`;
  const text = [
    `Hay ${n === 1 ? "1 documento vencido" : `${n} documentos vencidos`} pendiente(s) de cobro (total ${p.total}):`,
    "",
    ...p.items.map(
      (i) => `• ${i.kind}${i.number ? ` ${i.number}` : ""} — ${i.client} — ${i.total} — límite ${i.dueDate} (${i.daysLate} día(s) de atraso)\n  ${i.description}`,
    ),
    "",
    "Ver en el sistema:",
    p.link,
  ].join("\n");
  const rows = p.items
    .map(
      (i) => `<tr>
<td style="padding:8px 10px;border-bottom:1px solid #e5e5ea;"><strong>${esc(i.client)}</strong><br><span style="color:#86868b;font-size:12px;">${esc(i.kind)}${i.number ? ` ${esc(i.number)}` : ""} · ${esc(i.description)}</span></td>
<td style="padding:8px 10px;border-bottom:1px solid #e5e5ea;text-align:right;white-space:nowrap;">${esc(i.total)}</td>
<td style="padding:8px 10px;border-bottom:1px solid #e5e5ea;white-space:nowrap;">${esc(i.dueDate)}<br><span style="color:#D70015;font-size:12px;">${i.daysLate} día(s) de atraso</span></td>
</tr>`,
    )
    .join("");
  const html = shell(
    `<p style="margin:0 0 16px;">Hay <strong>${n === 1 ? "1 documento vencido" : `${n} documentos vencidos`}</strong> pendiente(s) de cobro por un total de <strong>${esc(p.total)}</strong>.</p>
<table style="width:100%;margin:0 0 20px;font-size:14px;border-collapse:collapse;">
<tr><th style="text-align:left;padding:6px 10px;color:#86868b;font-weight:500;">Cliente</th><th style="text-align:right;padding:6px 10px;color:#86868b;font-weight:500;">Total</th><th style="text-align:left;padding:6px 10px;color:#86868b;font-weight:500;">Fecha límite</th></tr>
${rows}
</table>
<p style="margin:0 0 8px;">${button(p.link, "Ver facturas vencidas")}</p>
<p style="margin:16px 0 0;font-size:12px;color:#86868b;">Este aviso se envía todos los días mientras haya documentos vencidos.</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}

export function passwordResetEmail(p: { name: string; link: string; withLogo: boolean }) {
  const subject = "Restablece tu contraseña — Sistema de reportes 311";
  const text = [
    `Hola ${p.name},`,
    "",
    "Recibimos una solicitud para restablecer tu contraseña. Usa este enlace (vigente por 1 hora):",
    p.link,
    "",
    "Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.",
    "",
    "Equipo 311.",
  ].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;">Hola <strong>${esc(p.name)}</strong>,</p>
<p style="margin:0 0 20px;">Recibimos una solicitud para restablecer tu contraseña. Pulsa el botón para elegir una nueva (el enlace vence en 1 hora):</p>
<p style="margin:0 0 24px;">${button(p.link, "Restablecer contraseña")}</p>
<p style="margin:0 0 16px;font-size:13px;color:#515154;">Si el botón no funciona, copia este enlace en tu navegador:<br>${esc(p.link)}</p>
<p style="margin:0 0 16px;">Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.</p>
<p style="margin:0;"><strong>Equipo 311.</strong></p>`,
    p.withLogo,
  );
  return { subject, text, html };
}


/** Resumen semanal de desempeño para el Administrador. Las cifras llegan ya con formato. */
export function desempenoSemanalEmail(p: {
  periodLabel: string; link: string; withLogo: boolean;
  team: { label: string; value: string }[];
  alerts: string[];
  areas: { name: string; cells: string[] }[];
  people: { name: string; cells: string[] }[];
}) {
  const subject = `Resumen semanal de desempeño · ${p.periodLabel}`;
  const head = ["Puntualidad", "Devoluciones", "Entregadas", "Abiertas / vencidas"];
  const textTable = (rows: { name: string; cells: string[] }[]) => rows.map((r) => `- ${r.name}: ${r.cells.map((c, i) => `${head[i]} ${c}`).join(" · ")}`);
  const text = [
    `Resumen del equipo del ${p.periodLabel}`,
    "",
    ...p.team.map((t) => `${t.label}: ${t.value}`),
    "",
    ...(p.alerts.length ? ["Para atender:", ...p.alerts.map((a) => `- ${a}`), ""] : []),
    "Por área:",
    ...textTable(p.areas),
    "",
    "Por persona:",
    ...textTable(p.people),
    "",
    "Ver el dashboard completo:",
    p.link,
  ].join("\n");
  const table = (title: string, rows: { name: string; cells: string[] }[]) =>
    rows.length === 0
      ? ""
      : `<p style="margin:18px 0 6px;font-weight:600;">${esc(title)}</p>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<tr style="text-align:left;color:#86868b;"><th style="padding:4px 8px 4px 0;font-weight:500;"></th>${head.map((h) => `<th style="padding:4px 8px;font-weight:500;">${h}</th>`).join("")}</tr>
${rows.map((r) => `<tr style="border-top:1px solid #e5e5ea;"><td style="padding:5px 8px 5px 0;">${esc(r.name)}</td>${r.cells.map((c) => `<td style="padding:5px 8px;">${esc(c)}</td>`).join("")}</tr>`).join("")}
</table>`;
  const html = shell(
    `<p style="margin:0 0 14px;">Este es el resumen de desempeño del equipo del <strong>${esc(p.periodLabel)}</strong>.</p>
<table style="margin:0 0 8px;font-size:14px;border-collapse:collapse;">
${p.team.map((t) => `<tr><td style="padding:3px 16px 3px 0;color:#86868b;">${esc(t.label)}</td><td><strong>${esc(t.value)}</strong></td></tr>`).join("")}
</table>
${p.alerts.length ? `<div style="margin:14px 0;padding:10px 14px;background:#fff4e5;border-radius:10px;font-size:14px;"><strong>Para atender</strong><ul style="margin:6px 0 0;padding-left:18px;">${p.alerts.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
${table("Por área", p.areas)}
${table("Por persona", p.people)}
<p style="margin:20px 0 8px;">${button(p.link, "Abrir el dashboard")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}

/** Aviso al TEAM 311: se le asignó una tarea nueva. */
export function tareaAsignadaEmail(p: { title: string; clientName: string; projectName: string; due: string; byName: string; link: string; withLogo: boolean }) {
  const subject = `Nueva tarea para ti: ${p.title}`;
  const text = [
    `${p.byName} te asignó una tarea nueva:`,
    "",
    p.title,
    `Cliente: ${p.clientName}`,
    `Proyecto: ${p.projectName}`,
    `Fecha de entrega: ${p.due}`,
    "",
    "Ábrela aquí:",
    p.link,
  ].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;"><strong>${esc(p.byName)}</strong> te asignó una tarea nueva:</p>
<p style="margin:0 0 16px;font-size:17px;"><strong>${esc(p.title)}</strong></p>
<table style="margin:0 0 20px;font-size:14px;border-collapse:collapse;">
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Cliente</td><td>${esc(p.clientName)}</td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Proyecto</td><td>${esc(p.projectName)}</td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Entrega</td><td>${esc(p.due)}</td></tr>
</table>
<p style="margin:0 0 8px;">${button(p.link, "Abrir la tarea")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}

/** Aviso a Administración: un TEAM 311 marcó una tarea como lista y espera revisión. */
export function tareaParaRevisarEmail(p: { title: string; teamName: string; clientName: string; projectName: string; note: string | null; link: string; withLogo: boolean }) {
  const subject = `Tarea lista para revisar: ${p.title} (${p.teamName})`;
  const text = [
    `${p.teamName} marcó como lista la tarea «${p.title}».`,
    "",
    `Cliente: ${p.clientName}`,
    `Proyecto: ${p.projectName}`,
    ...(p.note ? ["", `Comentario: ${p.note}`] : []),
    "",
    "Revísala y acéptala o devuélvela aquí:",
    p.link,
  ].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;"><strong>${esc(p.teamName)}</strong> marcó como <strong>lista</strong> la tarea <strong>${esc(p.title)}</strong> y espera tu revisión.</p>
<table style="margin:0 0 16px;font-size:14px;border-collapse:collapse;">
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Cliente</td><td>${esc(p.clientName)}</td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Proyecto</td><td>${esc(p.projectName)}</td></tr>
</table>
${p.note ? `<p style="margin:0 0 16px;padding:10px 14px;background:#f5f5f7;border-radius:10px;font-size:14px;">${esc(p.note)}</p>` : ""}
<p style="margin:0 0 8px;">${button(p.link, "Revisar tarea")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}

/** Aviso al TEAM 311: la tarea se devolvió a «En proceso» con un comentario. */
export function tareaDevueltaEmail(p: { title: string; byName: string; note: string; link: string; withLogo: boolean }) {
  const subject = `Tu tarea volvió a «En proceso»: ${p.title}`;
  const text = [`${p.byName} devolvió la tarea «${p.title}» a En proceso.`, "", `Comentario: ${p.note}`, "", p.link].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;"><strong>${esc(p.byName)}</strong> devolvió la tarea <strong>${esc(p.title)}</strong> a <strong>En proceso</strong>:</p>
<p style="margin:0 0 16px;padding:10px 14px;background:#f5f5f7;border-radius:10px;font-size:14px;">${esc(p.note)}</p>
<p style="margin:0 0 8px;">${button(p.link, "Abrir la tarea")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}


/** Aviso de un mensaje nuevo en el chat de una tarea. */
export function tareaMensajeEmail(p: { title: string; byName: string; snippet: string; link: string; withLogo: boolean }) {
  const subject = `Mensaje nuevo en la tarea «${p.title}»`;
  const text = [`${p.byName} escribió en la tarea «${p.title}»:`, "", p.snippet, "", p.link].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;"><strong>${esc(p.byName)}</strong> escribió en la tarea <strong>${esc(p.title)}</strong>:</p>
<p style="margin:0 0 20px;padding:10px 14px;background:#f5f5f7;border-radius:10px;font-size:14px;">${esc(p.snippet)}</p>
<p style="margin:0 0 8px;">${button(p.link, "Abrir la conversación")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}


/** Recordatorio al TEAM 311: la tarea vence en menos de 12 horas. */
export function tareaPorVencerEmail(p: { title: string; clientName: string; projectName: string; due: string; link: string; withLogo: boolean }) {
  const subject = `⏰ Tu tarea vence pronto: ${p.title}`;
  const text = [`La tarea «${p.title}» vence en menos de 12 horas.`, "", `Cliente: ${p.clientName}`, `Proyecto: ${p.projectName}`, `Entrega: ${p.due}`, "", "Ábrela aquí:", p.link].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;">Recordatorio amistoso: la tarea <strong>${esc(p.title)}</strong> vence en <strong>menos de 12 horas</strong>.</p>
<table style="margin:0 0 20px;font-size:14px;border-collapse:collapse;">
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Cliente</td><td>${esc(p.clientName)}</td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Proyecto</td><td>${esc(p.projectName)}</td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#86868b;">Entrega</td><td>${esc(p.due)}</td></tr>
</table>
<p style="margin:0 0 8px;">${button(p.link, "Abrir la tarea")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}

export type TareaVencida = { title: string; clientName: string; projectName: string; due: string; people: string; daysLate: number };

/** Aviso diario de tareas vencidas: para cada persona (sus tareas) y resumen para Administración (todas). */
export function tareasVencidasEmail(p: { forName: string | null; items: TareaVencida[]; link: string; withLogo: boolean }) {
  const n = p.items.length;
  const subject = p.forName ? `Tienes ${n === 1 ? "1 tarea vencida" : `${n} tareas vencidas`}` : `${n === 1 ? "1 tarea vencida" : `${n} tareas vencidas`} en el equipo`;
  const line = (i: TareaVencida) => `• ${i.title} (${i.clientName} · ${i.projectName})${p.forName ? "" : ` — ${i.people}`} — venció el ${i.due}`;
  const text = [p.forName ? `Hola ${p.forName}, estas tareas ya pasaron su fecha de entrega:` : "Estas tareas ya pasaron su fecha de entrega:", "", ...p.items.map(line), "", p.link].join("\n");
  const rows = p.items
    .map((i) => `<tr><td style="padding:4px 10px 4px 0;"><strong>${esc(i.title)}</strong><br><span style="color:#86868b;font-size:12px;">${esc(i.clientName)} · ${esc(i.projectName)}${p.forName ? "" : ` · ${esc(i.people)}`}</span></td><td style="padding:4px 0;white-space:nowrap;color:#d70015;">${esc(i.due)}</td></tr>`)
    .join("");
  const html = shell(
    `<p style="margin:0 0 16px;">${p.forName ? `Hola <strong>${esc(p.forName)}</strong>, estas tareas ya pasaron su fecha de entrega:` : "Estas tareas ya pasaron su fecha de entrega:"}</p>
<table style="margin:0 0 20px;font-size:14px;border-collapse:collapse;">${rows}</table>
<p style="margin:0 0 8px;">${button(p.link, "Ver las tareas")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}


/** Recordatorio de una nota del Baúl. */
export function notaRecordatorioEmail(p: { title: string; snippet: string; link: string; withLogo: boolean }) {
  const subject = `⏰ Recordatorio: ${p.title || "Nota del Baúl"}`;
  const text = [`Recordatorio de tu nota «${p.title || "sin título"}»:`, "", p.snippet, "", p.link].join("\n");
  const html = shell(
    `<p style="margin:0 0 16px;">⏰ Recordatorio de tu nota <strong>${esc(p.title || "sin título")}</strong>:</p>
<p style="margin:0 0 20px;padding:10px 14px;background:#f5f5f7;border-radius:10px;font-size:14px;">${esc(p.snippet || "Abre la nota para ver su contenido.")}</p>
<p style="margin:0 0 8px;">${button(p.link, "Abrir la nota")}</p>`,
    p.withLogo,
  );
  return { subject, text, html };
}
