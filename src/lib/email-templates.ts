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
