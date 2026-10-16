// Genera imagenes de ejemplo: logos de muestra y "fotos" de evidencia (todo inventado)
import fs from "node:fs";
import path from "node:path";
import { launch, ASSETS } from "./lib.mjs";

fs.mkdirSync(ASSETS, { recursive: true });

const logo = (text, color, sub = "") => `
<html><body style="margin:0;background:transparent">
<div id="c" style="display:inline-flex;align-items:center;gap:14px;padding:6px;font-family:Arial,Helvetica,sans-serif">
  <div style="background:${color};color:#fff;font-weight:700;font-size:40px;width:76px;height:76px;border-radius:16px;display:flex;align-items:center;justify-content:center">${text.slice(0, 3)}</div>
  <div style="color:${color};line-height:1.05"><div style="font-weight:700;font-size:30px;letter-spacing:.5px">${sub || text}</div></div>
</div></body></html>`;

const photo = (title, c1, c2) => `
<html><body style="margin:0"><div id="c" style="width:1200px;height:800px;background:linear-gradient(135deg,${c1},${c2});display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;color:#fff">
<div style="font-size:120px">&#128247;</div><div style="font-size:54px;font-weight:700;margin-top:10px">${title}</div>
<div style="font-size:28px;opacity:.85;margin-top:8px">Imagen de ejemplo</div></div></body></html>`;

// Retratos de ejemplo (siluetas sencillas sobre color): no son personas reales
const persona = (c1, c2, skin) => `
<html><body style="margin:0"><div id="c" style="width:400px;height:400px;background:linear-gradient(160deg,${c1},${c2});position:relative;overflow:hidden">
  <svg viewBox="0 0 400 400" width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="200" cy="420" rx="170" ry="150" fill="rgba(255,255,255,.85)"/>
    <rect x="170" y="235" width="60" height="70" rx="22" fill="${skin}"/>
    <circle cx="200" cy="175" r="78" fill="${skin}"/>
    <path d="M120 170 C120 95 165 80 200 80 C245 80 282 105 280 170 C262 140 240 128 200 128 C160 128 138 142 120 170Z" fill="#2b2118"/>
  </svg></div></body></html>`;

const browser = await launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

async function shot(html, file, { type = "png", omit = false } = {}) {
  await page.setContent(html);
  const el = await page.$("#c");
  await el.screenshot({ path: path.join(ASSETS, file), type, omitBackground: omit, ...(type === "jpeg" ? { quality: 85 } : {}) });
}

if (!fs.existsSync(path.join(ASSETS, "logo-311.png"))) {
  await shot(logo("311", "#007AFF", "311 CONSULTORES"), "logo-311.png", { omit: true });
}
await shot(logo("HRZ", "#0F766E", "Constructora Horizonte"), "logo-horizonte.png", { omit: true });
await shot(logo("CSA", "#B91C1C", "Clínica Santa Aurora"), "logo-aurora.png", { omit: true });
await shot(logo("ECA", "#7C3AED", "Estudio Creativo Aurora"), "logo-estudio.png", { omit: true });
await shot(persona("#60A5FA", "#2563EB", "#E8B994"), "persona-ana.jpg", { type: "jpeg" });
await shot(persona("#34D399", "#047857", "#C68642"), "persona-luis.jpg", { type: "jpeg" });
await shot(photo("Reunión de arranque", "#2563EB", "#7C3AED"), "foto-1.jpg", { type: "jpeg" });
await shot(photo("Recorrido en obra", "#059669", "#0EA5E9"), "foto-2.jpg", { type: "jpeg" });
await shot(photo("Entrega de avances", "#EA580C", "#DB2777"), "foto-3.jpg", { type: "jpeg" });

// PDF de ejemplo para la constancia fiscal
await page.setContent(`<html><body style="font-family:Arial;padding:60px"><h1>Constancia de Situación Fiscal</h1><p>Documento de ejemplo para el manual.</p><p>RFC: XAXX010101000</p></body></html>`);
await page.pdf({ path: path.join(ASSETS, "constancia-ejemplo.pdf"), format: "A4" });

await browser.close();
console.log("Listo:", fs.readdirSync(ASSETS).join(", "));
