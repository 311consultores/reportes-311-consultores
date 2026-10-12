// Genera hojas de contacto (miniaturas) del PDF para revisarlo: node manual/preview.mjs
import fs from "node:fs";
import path from "node:path";
import { launch, ROOT } from "./lib.mjs";

const pdf = fs.readFileSync(path.join(ROOT, "Manual-de-uso-311-Consultores.pdf"));
const pdfjs = path.join(ROOT, "node_modules", "pdfjs-dist", "build");
const out = path.join(ROOT, "salida", "prev");
fs.mkdirSync(out, { recursive: true });
const b = await launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1200 } });
await page.setContent("<html><body style='margin:0;background:#888'></body></html>");
await page.addScriptTag({ content: fs.readFileSync(path.join(pdfjs, "pdf.min.js"), "utf8") });
const worker = fs.readFileSync(path.join(pdfjs, "pdf.worker.min.js"), "utf8");
const total = await page.evaluate(async ({ b64, worker }) => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: "text/javascript" }));
  window.doc = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise;
  return window.doc.numPages;
}, { b64: pdf.toString("base64"), worker });

const PER = 8; // 4 x 2
for (let start = 1, sheet = 1; start <= total; start += PER, sheet++) {
  await page.evaluate(async ({ start, PER, total }) => {
    document.body.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:grid;grid-template-columns:repeat(4,390px);gap:8px;padding:8px;width:1600px";
    document.body.append(wrap);
    for (let p = start; p < Math.min(start + PER, total + 1); p++) {
      const pg = await window.doc.getPage(p);
      const vp = pg.getViewport({ scale: 390 / pg.getViewport({ scale: 1 }).width });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height; c.style.background = "#fff";
      wrap.append(c);
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      const lab = document.createElement("div");
      lab.textContent = "p." + p; lab.style.cssText = "position:absolute;background:#000;color:#fff;font:12px Arial;padding:1px 5px";
      c.after(lab);
    }
  }, { start, PER, total });
  await page.screenshot({ path: path.join(out, `hoja-${String(sheet).padStart(2, "0")}.png`), fullPage: true });
}
await b.close();
console.log("hojas:", fs.readdirSync(out).join(", "));
