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
