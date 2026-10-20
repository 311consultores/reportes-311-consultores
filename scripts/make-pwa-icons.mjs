// Genera los íconos de la app (cubo del logo 311 sobre fondo blanco) con Chrome
import path from "node:path";
import fs from "node:fs";
import { launch, ROOT } from "../manual/lib.mjs";

const logo = "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "assets", "logo-311.png")).toString("base64");
const out = path.join(ROOT, "..", "public", "icons");
const browser = await launch();
const page = await browser.newPage();
// El logo mide 1995x456 y el cubo ocupa el lado izquierdo (~430 px): se recorta mostrando solo el cubo, centrado
async function icon(file, size, cubeFrac) {
  const h = size * cubeFrac;
  const scale = h / 456;
  const left = size / 2 - 215 * scale;
  const top = (size - h) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0"><div id="c" style="width:${size}px;height:${size}px;background:#fff;position:relative;overflow:hidden"><img src="${logo}" style="position:absolute;left:${left}px;top:${top}px;width:${1995 * scale}px;height:${h}px"></div></body>`);
  await (await page.$("#c")).screenshot({ path: path.join(out, file) });
}
await icon("icon-512.png", 512, 0.68);
await icon("icon-192.png", 192, 0.68);
await icon("apple-touch-icon.png", 180, 0.68);
await icon("maskable-512.png", 512, 0.5); // con más margen para recortes redondeados
await browser.close();
console.log("íconos listos:", fs.readdirSync(out).join(", "));
