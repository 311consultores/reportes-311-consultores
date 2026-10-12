// Renderiza paginas de un PDF a PNG: node manual/render-pdf.mjs <archivo.pdf> <carpeta-salida> [maxPaginas]
import fs from "node:fs";
import path from "node:path";
import { launch, ROOT } from "./lib.mjs";

const [, , file, outDir, max = "4"] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const pdfjs = path.join(ROOT, "node_modules", "pdfjs-dist", "build");
const b = await launch();
const page = await b.newPage({ viewport: { width: 900, height: 1200 } });
await page.setContent("<html><body style='margin:0;background:#888'><canvas id='c'></canvas></body></html>");
await page.addScriptTag({ content: fs.readFileSync(path.join(pdfjs, "pdf.min.js"), "utf8") });
const worker = fs.readFileSync(path.join(pdfjs, "pdf.worker.min.js"), "utf8");
const total = await page.evaluate(async ({ b64, worker }) => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: "text/javascript" }));
  window.doc = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise;
  return window.doc.numPages;
}, { b64: fs.readFileSync(file).toString("base64"), worker });
for (let p = 1; p <= Math.min(total, Number(max)); p++) {
  await page.evaluate(async (p) => {
    const pg = await window.doc.getPage(p);
    const vp = pg.getViewport({ scale: 1.5 });
    const c = document.getElementById("c");
    c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  }, p);
  await page.locator("#c").screenshot({ path: path.join(outDir, `p${p}.png`) });
}
await b.close();
console.log("páginas totales:", total);
