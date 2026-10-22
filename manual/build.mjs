// Genera el manual en PDF: node manual/build.mjs   (requiere haber tomado las capturas con capture.mjs)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { launch, ROOT, SHOTS, ASSETS } from "./lib.mjs";
// Un manual por tipo de usuario: node manual/build.mjs [editor|project]
const PERFILES = {
  editor: {
    contenido: "./contenido.mjs", pdf: "Manual-de-uso-311-Consultores.pdf", pill: "Guía para la asistente (rol Editor)", footer: "Manual de uso · Sistema de Reportes · 311 Consultores",
    titulo: "Manual de uso<br>Sistema de Reportes", sub: "Cómo capturar reportes, administrar clientes y enviar el trabajo terminado, paso a paso y con imágenes.",
    leer: "las secciones 1 a 5", version: "Versión 2.0 · 20 de octubre de 2026", figH: "205mm",
  },
  admin: {
    contenido: "./contenido-admin.mjs", pdf: "Manual-ADMINISTRADOR.pdf", pill: "Guía para el perfil ADMINISTRADOR", footer: "Manual ADMINISTRADOR · Portal de Operaciones · 311 Consultores",
    titulo: "Manual del perfil<br>ADMINISTRADOR", sub: "Desempeño del equipo, áreas, usuarios y roles, y autorización de solicitudes, paso a paso y con imágenes.",
    leer: "las secciones 1 a 4", version: "Versión 1.0 · 22 de octubre de 2026", figH: "135mm",
  },
  project: {
    contenido: "./contenido-project.mjs", pdf: "Manual-PROJECT-311.pdf", pill: "Guía para el perfil PROJECT 311", footer: "Manual PROJECT 311 · Portal de Operaciones · 311 Consultores",
    titulo: "Manual del perfil<br>PROJECT 311", sub: "Cómo crear, asignar, dar seguimiento y aceptar tareas del equipo, paso a paso y con imágenes.",
    leer: "las secciones 1 a 5", version: "Versión 1.0 · 21 de octubre de 2026", figH: "135mm",
  },
};
const PERFIL = PERFILES[process.argv[2] ?? "editor"];
if (!PERFIL) throw new Error("Perfil desconocido: usa editor o project");
const { secciones } = await import(PERFIL.contenido);

const require = createRequire(import.meta.url);
const OUT_HTML = path.join(ROOT, "salida", `manual-${process.argv[2] ?? "editor"}.html`);
const OUT_PDF = path.join(ROOT, PERFIL.pdf);
fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });

const VERSION = PERFIL.version;
const esc = (s) => s; // el contenido ya es HTML controlado por nosotros
const num = (x) => x.replace(/<n>(\d+)<\/n>/g, '<span class="n">$1</span>');
const img = (f) => pathToFileURL(f).href;

const logoPath = ["logo-311.png"].map((f) => path.join(ASSETS, f)).find((p) => fs.existsSync(p));

function block(b) {
  switch (b.t) {
    case "p": return `<p>${num(b.x)}</p>`;
    case "h3": return `<h3>${b.x}</h3>`;
    case "steps": return `<ol class="steps">${b.x.map((s) => `<li>${num(s)}</li>`).join("")}</ol>`;
    case "bullets": return `<ul class="bul">${b.x.map((s) => `<li>${num(s)}</li>`).join("")}</ul>`;
    case "note": {
      const label = { tip: "Consejo", warn: "Importante", info: "Para saber" }[b.k];
      return `<div class="note ${b.k}"><b>${label}.</b> ${num(b.x)}</div>`;
    }
    case "table":
      return `<table><thead><tr>${b.head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${b.rows
        .map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="k"' : ""}>${num(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
    case "faq":
      return b.items.map(([q, a]) => `<div class="faq"><div class="q">${q}</div><div class="a">${num(a)}</div></div>`).join("");
    case "flow":
      return `<div class="flow">
        <span class="st s1">En proceso</span><i>→</i><span class="st s2">Terminado</span><i>→</i>
        <span class="split"><span class="st s3">Aprobado</span><span class="st s4">Rechazado</span></span>
        <i>→</i><span class="split"><span class="st s5">Enviado</span><span class="back">Rechazado: vuelves a corregir y lo marcas como terminado otra vez</span></span>
      </div>`;
    case "fig": {
      const file = path.join(SHOTS, b.f + ".png");
      if (!fs.existsSync(file)) throw new Error("Falta la captura " + b.f);
      const legend = b.l.length
        ? `<ol class="legend">${b.l.map((t, i) => `<li><span class="n">${i + 1}</span><span>${num(t)}</span></li>`).join("")}</ol>`
        : "";
      return `<figure style="--w:${b.max ?? 100}%"><img src="${img(file)}" alt=""><figcaption>${b.c}</figcaption>${legend}</figure>`;
    }
    default: throw new Error("Bloque desconocido " + b.t);
  }
}

function html(pages) {
  const toc = secciones
    .map((s, i) => `<li><a href="#${s.id}"><span class="tn">${i + 1}.</span><span class="tt">${s.titulo}</span><span class="td"></span><span class="tp">${pages?.[s.id] ?? ""}</span></a></li>`)
    .join("");
  const body = secciones
    .map((s, i) => `<section id="${s.id}"><h2><span>${i + 1}.</span> ${s.titulo}</h2>${s.bloques.map(block).join("\n")}</section>`)
    .join("\n");
  const logo = logoPath ? `<img class="logo" src="${img(logoPath)}" alt="311 Consultores">` : `<div class="logo-txt">311 CONSULTORES</div>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Manual de uso — Sistema de Reportes 311 Consultores</title>
<style>
@page { size: A4; margin: 20mm 18mm 20mm 18mm;
  @bottom-left { content: "${PERFIL.footer}"; font: 8pt Arial, sans-serif; color: #8a8f98; }
  @bottom-right { content: counter(page); font: 8pt Arial, sans-serif; color: #8a8f98; } }
@page :first { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1d1d1f; font-size: 10.5pt; line-height: 1.5; }
body { margin: 0; }
.cover { height: 297mm; width: 210mm; padding: 28mm 24mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always;
  background: linear-gradient(160deg, #f5f9ff 0%, #ffffff 55%); position: relative; overflow: hidden; }
.cover .band { position: absolute; right: -30mm; top: 118mm; width: 120mm; height: 120mm; border-radius: 50%; background: #007aff; opacity: .08; }
.cover .band2 { position: absolute; left: -40mm; bottom: -40mm; width: 110mm; height: 110mm; border-radius: 50%; background: #007aff; opacity: .06; }
.cover .logo { max-height: 22mm; max-width: 80mm; object-fit: contain; align-self: flex-start; }
.logo-txt { font-weight: 700; font-size: 22pt; color: #007aff; }
.cover h1 { font-size: 34pt; line-height: 1.1; margin: 0 0 8mm; letter-spacing: -.5pt; }
.cover .sub { font-size: 14pt; color: #4b5563; max-width: 130mm; }
.cover .pill { display: inline-block; background: #007aff; color: #fff; padding: 2mm 5mm; border-radius: 99px; font-weight: 600; font-size: 10pt; margin-bottom: 8mm; }
.cover .meta { color: #6b7280; font-size: 10pt; }
.tocpage { page-break-after: always; }
.tocpage h2 { font-size: 22pt; margin: 0 0 8mm; letter-spacing: -.3pt; }
.toc { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 0; }
.toc a { display: flex; align-items: baseline; gap: 3mm; text-decoration: none; color: #1d1d1f; padding: 1.2mm 0; border-bottom: 1px solid #eceef2; font-size: 10.5pt; }
.toc .tn { width: 8mm; color: #007aff; font-weight: 700; }
.toc .tt { font-weight: 500; }
.toc .td { flex: 1; border-bottom: 1px dotted #c3c8d0; transform: translateY(-2px); }
.toc .tp { width: 8mm; text-align: right; color: #6b7280; }
.how { margin-top: 10mm; background: #f5f7fb; border-radius: 4mm; padding: 5mm 6mm; font-size: 10pt; color: #374151; }
.how b { color: #1d1d1f; }
section { page-break-before: always; }
section:first-of-type { page-break-before: auto; }
h2 { font-size: 20pt; margin: 0 0 6mm; letter-spacing: -.3pt; padding-bottom: 3mm; border-bottom: 3px solid #007aff; page-break-after: avoid; }
h2 span { color: #007aff; margin-right: 2mm; }
h3 { font-size: 13pt; margin: 7mm 0 2.5mm; color: #0b3d91; page-break-after: avoid; }
p { margin: 0 0 3mm; }
ol.steps { counter-reset: s; list-style: none; padding: 0; margin: 2mm 0 4mm; }
ol.steps li { counter-increment: s; position: relative; padding: 0 0 2.4mm 9mm; page-break-inside: avoid; }
ol.steps li::before { content: counter(s); position: absolute; left: 0; top: 0.3mm; width: 6mm; height: 6mm; border-radius: 50%; background: #007aff; color: #fff; font-weight: 700; font-size: 9pt; display: flex; align-items: center; justify-content: center; }
ul.bul { padding-left: 6mm; margin: 1mm 0 4mm; }
ul.bul li { margin-bottom: 1.5mm; }
.n { display: inline-flex; align-items: center; justify-content: center; width: 4.6mm; height: 4.6mm; border-radius: 50%; background: #e5252a; color: #fff; font: 700 8pt Arial, sans-serif; vertical-align: 1px; }
figure { margin: 4mm auto 6mm; width: var(--w); page-break-inside: avoid; }
figure img { width: 100%; display: block; border: 1px solid #d7dbe2; border-radius: 3mm; box-shadow: 0 1px 6px rgba(0,0,0,.08); max-height: ${PERFIL.figH}; object-fit: contain; background: #fff; }
figcaption { font-size: 9pt; color: #6b7280; margin: 1.5mm 0 2mm; text-align: center; font-style: italic; }
ol.legend { list-style: none; margin: 0; padding: 2.5mm 4mm; background: #f7f8fa; border-radius: 3mm; columns: 1; font-size: 9.5pt; }
ol.legend li { display: flex; gap: 2.5mm; align-items: flex-start; margin: 0 0 1.2mm; }
ol.legend .n { flex: none; margin-top: 0.4mm; }
.note { border-left: 4px solid; border-radius: 0 3mm 3mm 0; padding: 3mm 4mm; margin: 3mm 0 5mm; page-break-inside: avoid; font-size: 10pt; }
.note.tip { background: #eaf7ee; border-color: #34c759; }
.note.warn { background: #fff4e5; border-color: #ff9500; }
.note.info { background: #eaf3ff; border-color: #007aff; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9.8pt; page-break-inside: auto; }
th { text-align: left; background: #f0f3f8; padding: 2mm 3mm; border-bottom: 2px solid #d7dbe2; }
td { padding: 2mm 3mm; border-bottom: 1px solid #e6e9ef; vertical-align: top; }
td.k { font-weight: 600; white-space: nowrap; }
tr { page-break-inside: avoid; }
.faq { page-break-inside: avoid; margin-bottom: 3.5mm; border: 1px solid #e3e7ee; border-radius: 3mm; overflow: hidden; }
.faq .q { background: #f3f6fb; padding: 2mm 4mm; font-weight: 600; }
.faq .a { padding: 2mm 4mm; }
.flow { display: flex; align-items: center; gap: 2mm; flex-wrap: wrap; margin: 3mm 0 5mm; font-size: 9.5pt; }
.flow i { font-style: normal; color: #9aa0aa; font-size: 14pt; }
.st { display: inline-block; padding: 1.5mm 4mm; border-radius: 99px; font-weight: 700; font-size: 9.5pt; }
.s1 { background: #fff0db; color: #b45309; } .s2 { background: #e0efff; color: #0b5cd5; }
.s3 { background: #dff5e6; color: #15803d; } .s4 { background: #fde2e2; color: #c01818; } .s5 { background: #e9eaee; color: #444; }
.split { display: inline-flex; flex-direction: column; gap: 1.5mm; }
.back { font-size: 8.5pt; color: #6b7280; max-width: 52mm; line-height: 1.25; }
a { color: inherit; }
</style></head><body>
<div class="cover"><div class="band"></div><div class="band2"></div>
  ${logo}
  <div><div class="pill">${PERFIL.pill}</div>
  <h1>${PERFIL.titulo}</h1>
  <div class="sub">${PERFIL.sub}</div></div>
  <div class="meta">311 CONSULTORES · reportes.311consultores.com<br>${VERSION}</div>
</div>
<div class="tocpage"><h2>Contenido</h2><ol class="toc">${toc}</ol>
<div class="how"><b>Cómo usar este manual.</b> Las imágenes muestran las pantallas reales del sistema con datos de ejemplo inventados. Los <span class="n">1</span> rojos de cada imagen se explican en la lista que aparece debajo de ella, y en los pasos se mencionan con el mismo número. Si estás empezando, lee ${PERFIL.leer} en orden; después úsalo como consulta.</div></div>
${body}
</body></html>`;
}

async function renderPdf(pagesMap) {
  fs.writeFileSync(OUT_HTML, html(pagesMap), "utf8");
  const b = await launch();
  const page = await b.newPage();
  await page.goto(pathToFileURL(OUT_HTML).href, { waitUntil: "load" });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.pdf({ path: OUT_PDF, format: "A4", printBackground: true, preferCSSPageSize: true });
  await b.close();
}

async function pageMap() {
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
  const data = new Uint8Array(fs.readFileSync(OUT_PDF));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  const map = {};
  const texts = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    texts.push(tc.items.map((i) => i.str).join(" ").replace(/\s+/g, " "));
  }
  secciones.forEach((s, i) => {
    const head = `${i + 1}. ${s.titulo}`.replace(/\s+/g, " ");
    const first = texts.findIndex((t, k) => k > 0 && t.includes("Cómo usar este manual")); // el contenido empieza después de la portada y el índice (que puede ocupar varias páginas)
    for (let p = Math.max(first, 2); p < texts.length; p++) {
      const t = texts[p];
      const note = t.indexOf("Cómo usar este manual");
      const at = t.indexOf(head);
      // En la página donde termina el índice (y empieza la nota «Cómo usar»), lo anterior a la nota todavía es el índice
      if (at >= 0 && (note < 0 || at > note)) { map[s.id] = p + 1; break; }
    }
  });
  return { map, total: doc.numPages };
}

await renderPdf(null);
const { map, total } = await pageMap();
await renderPdf(map);
const second = await pageMap();
console.log("Páginas:", total, "→", second.total, JSON.stringify(second.map));
console.log("PDF:", OUT_PDF, (fs.statSync(OUT_PDF).size / 1048576).toFixed(1) + " MB");

