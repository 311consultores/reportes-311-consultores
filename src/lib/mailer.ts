import { gmail, auth } from "@googleapis/gmail";

export type InlineImage = { cid: string; content: Buffer; contentType: string; filename: string };
export type Mail = {
  to: string[];
  subject: string;
  html: string;
  text: string;
  inline?: InlineImage[];
  attachment?: { filename: string; content: Buffer; contentType?: string };
};

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
const boundary = () => `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

type Part = { header: string; body: string };

const textPart = (type: "plain" | "html", content: string): Part => ({
  header: `Content-Type: text/${type}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64`,
  body: wrap64(Buffer.from(content, "utf8")),
});

function multipart(sub: "mixed" | "related" | "alternative", parts: Part[]): Part {
  const b = boundary();
  return {
    header: `Content-Type: multipart/${sub}; boundary="${b}"`,
    body: parts.map((p) => `--${b}\r\n${p.header}\r\n\r\n${p.body}`).join("\r\n") + `\r\n--${b}--`,
  };
}

export function buildMime(from: string, m: Mail) {
  // alternative(texto, html) -> related(+ imágenes en línea) -> mixed(+ adjunto)
  let main = multipart("alternative", [textPart("plain", m.text), textPart("html", m.html)]);
  if (m.inline?.length) {
    main = multipart("related", [
      main,
      ...m.inline.map<Part>((i) => ({
        header:
          `Content-Type: ${i.contentType}; name="${i.filename}"\r\nContent-Transfer-Encoding: base64\r\n` +
          `Content-ID: <${i.cid}>\r\nContent-Disposition: inline; filename="${i.filename}"`,
        body: wrap64(i.content),
      })),
    ]);
  }
  if (m.attachment) {
    const ct = m.attachment.contentType ?? "application/pdf";
    main = multipart("mixed", [
      main,
      {
        header:
          `Content-Type: ${ct}; name="${m.attachment.filename}"\r\nContent-Transfer-Encoding: base64\r\n` +
          `Content-Disposition: attachment; filename="${m.attachment.filename}"`,
        body: wrap64(m.attachment.content),
      },
    ]);
  }
  return [
    `From: ${encHeader("311 CONSULTORES")} <${from}>`,
    `To: ${m.to.join(", ")}`,
    `Subject: ${encHeader(m.subject)}`,
    "MIME-Version: 1.0",
    main.header,
    "",
    main.body,
  ].join("\r\n");
}

export async function sendMail(m: Mail): Promise<{ dryRun: boolean }> {
  // El modo de prueba tiene prioridad aunque Gmail esté configurado (nunca aplica en producción)
  if (mailDryRun()) {
    console.log(
      `[MAIL_DRY_RUN] Para: ${m.to.join(", ")} | Asunto: ${m.subject} | Adjunto: ${m.attachment?.filename ?? "—"}\n${m.text}`,
    );
    return { dryRun: true };
  }
  if (!mailConfigured()) {
    throw new Error("Gmail no está configurado (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER)");
  }

  const oauth = new auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const raw = Buffer.from(buildMime(process.env.GMAIL_SENDER!, m)).toString("base64url");
  await gmail({ version: "v1", auth: oauth }).users.messages.send({ userId: "me", requestBody: { raw } });
  return { dryRun: false };
}
