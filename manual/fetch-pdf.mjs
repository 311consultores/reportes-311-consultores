// Descarga el PDF de un reporte del sistema LOCAL: node manual/fetch-pdf.mjs <idReporte> <salida.pdf>
import fs from "node:fs";
import path from "node:path";
import { launch, ROOT } from "./lib.mjs";
const [, , id, out] = process.argv;
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "..", ".env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const b = await launch();
const ctx = await b.newContext();
const page = await ctx.newPage();
await page.goto("http://localhost:3000/login");
await page.fill("#email", "editor@311consultores.com");
await page.fill("#password", env.SEED_EDITOR_PASSWORD);
await page.click("form button.btn");
await page.waitForURL("http://localhost:3000/");
const res = await ctx.request.get(`http://localhost:3000/api/reports/${id}/pdf`, { timeout: 120000 });
const buf = await res.body();
if (buf.subarray(0, 4).toString() !== "%PDF") throw new Error("No se generó el PDF: " + res.status() + " " + buf.toString().slice(0, 200));
fs.writeFileSync(out, buf);
await b.close();
console.log("PDF guardado", buf.length);
