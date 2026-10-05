import { gmail, auth } from "@googleapis/gmail";

type Mail = { to: string[]; subject: string; html: string; attachment: { filename: string; content: Buffer } };

export const mailConfigured = () =>
  !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_SENDER
  );

/** Solo desarrollo: registra el envío en consola en lugar de llamar a Gmail. */
export const mailDryRun = () => process.env.MAIL_DRY_RUN === "true" && process.env.NODE_ENV !== "production";

const encHeader = (s: string) => `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
const wrap64 = (b: Buffer) => b.toString("base64").replace(/.{76}/g, "$&\r\n");

function buildMime(from: string, m: Mail) {
  const boundary = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return [
    `From: ${encHeader("311 CONSULTORES")} <${from}>`,
    `To: ${m.to.join(", ")}`,
    `Subject: ${encHeader(m.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap64(Buffer.from(m.html, "utf8")),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${m.attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${m.attachment.filename}"`,
    "",
    wrap64(m.attachment.content),
    `--${boundary}--`,
  ].join("\r\n");
}

export async function sendMail(m: Mail): Promise<{ dryRun: boolean }> {
  if (!mailConfigured()) {
    if (mailDryRun()) {
      console.log(`[MAIL_DRY_RUN] Para: ${m.to.join(", ")} | Asunto: ${m.subject} | Adjunto: ${m.attachment.filename}`);
      return { dryRun: true };
    }
    throw new Error("Gmail no está configurado (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER)");
  }

  const oauth = new auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const raw = Buffer.from(buildMime(process.env.GMAIL_SENDER!, m)).toString("base64url");
  await gmail({ version: "v1", auth: oauth }).users.messages.send({ userId: "me", requestBody: { raw } });
  return { dryRun: false };
}
