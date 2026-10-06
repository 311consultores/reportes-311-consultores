// Envía un correo de prueba con las credenciales de .env.
// Uso: npm run gmail:test -- destinatario@dominio.com
import { gmail, auth } from "@googleapis/gmail";

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER } = process.env;
const to = process.argv[2];
if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_SENDER) {
  console.error("Faltan variables GMAIL_* en .env (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, SENDER)");
  process.exit(1);
}
if (!to) {
  console.error("Indica el destinatario: npm run gmail:test -- tu-correo@dominio.com");
  process.exit(1);
}

const enc = (s) => `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
const oauth = new auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

const raw = Buffer.from(
  [
    `From: ${enc("311 CONSULTORES")} <${GMAIL_SENDER}>`,
    `To: ${to}`,
    `Subject: ${enc("Prueba de envío — Sistema de reportes 311")}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("Este es un correo de prueba del sistema de reportes de 311 CONSULTORES.\nSi lo recibes, la integración con Gmail API funciona.").toString("base64"),
  ].join("\r\n"),
).toString("base64url");

try {
  const res = await gmail({ version: "v1", auth: oauth }).users.messages.send({ userId: "me", requestBody: { raw } });
  console.log(`Enviado a ${to} (id ${res.data.id}) desde la cuenta autorizada.`);
} catch (e) {
  const msg = e?.response?.data?.error_description || e?.response?.data?.error?.message || e.message;
  console.error("Error al enviar:", msg);
  if (/invalid_grant/.test(String(msg))) console.error("El refresh token venció o fue revocado: ejecuta de nuevo npm run gmail:token");
  process.exit(1);
}
