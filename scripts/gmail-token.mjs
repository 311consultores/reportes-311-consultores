// Obtiene el refresh token de Gmail y lo guarda en .env (los secretos no se imprimen).
// Requisitos: GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET definidos en .env
// Uso: npm run gmail:token
import http from "node:http";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { auth } from "@googleapis/gmail";

const { GMAIL_CLIENT_ID: id, GMAIL_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Faltan GMAIL_CLIENT_ID y/o GMAIL_CLIENT_SECRET en .env");
  process.exit(1);
}

const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}/oauth2callback`;
const client = new auth.OAuth2(id, secret, redirect);
const state = randomBytes(16).toString("hex");

const url = client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // fuerza la entrega del refresh token
  scope: ["https://www.googleapis.com/auth/gmail.send"],
  state,
});

function saveEnv(key, value) {
  const file = ".env";
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text) ? text.replace(re, line) : text.replace(/\s*$/, "\n") + line + "\n";
  fs.writeFileSync(file, text);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== "/oauth2callback") return res.writeHead(404).end();
  const done = (code, msg) => {
    res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" }).end(`<p style="font:16px sans-serif">${msg}</p>`);
    setTimeout(() => process.exit(code === 200 ? 0 : 1), 300);
  };
  try {
    if (u.searchParams.get("state") !== state) return done(400, "Estado inválido. Vuelve a intentarlo.");
    if (u.searchParams.get("error")) return done(400, `Autorización rechazada: ${u.searchParams.get("error")}`);
    const { tokens } = await client.getToken(u.searchParams.get("code"));
    if (!tokens.refresh_token) {
      return done(400, "Google no devolvió refresh token. Quita el acceso de la app en https://myaccount.google.com/permissions y reintenta.");
    }
    saveEnv("GMAIL_REFRESH_TOKEN", tokens.refresh_token);
    console.log("\nListo: GMAIL_REFRESH_TOKEN guardado en .env");
    done(200, "Listo. Ya puedes cerrar esta pestaña y volver a la terminal.");
  } catch (e) {
    console.error("Error:", e.message);
    done(500, "Error al obtener el token. Revisa la terminal.");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Abre esta URL en el navegador, con la cuenta corporativa que enviará los correos:\n");
  console.log(url + "\n");
  console.log("Esperando la autorización...");
});
