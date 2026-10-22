// Capturas del manual del ADMINISTRADOR (carpeta capturas/admin). Requiere: servidor local en :3000, los datos de ejemplo (seed-demo.ts)
// y las tareas de ejemplo del dashboard (node --env-file=.env manual/seed-demo-metricas.cjs). No borra las capturas de otros manuales.
import fs from "node:fs";
import path from "node:path";
import { launch, SHOTS } from "./lib.mjs";

const BASE = "http://localhost:3000";
const OUT = path.join(SHOTS, "admin");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "es-MX", colorScheme: "light", timezoneId: "America/Mexico_City" });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

const HIDE = "nextjs-portal{display:none!important} *{caret-color:transparent!important}";
async function ready() {
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(250);
}
async function go(url) {
  await page.goto(BASE + url);
  await ready();
}

async function mark(items) {
  const boxes = [];
  for (const it of items) {
    const loc = typeof it.loc === "string" ? page.locator(it.loc).first() : it.loc.first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const bb = await loc.boundingBox();
    if (!bb) throw new Error("No se encontro el elemento para la marca " + it.n);
    const [sx, sy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
    boxes.push({ n: it.n, at: it.at, pad: it.pad, bb: { x: bb.x + sx, y: bb.y + sy, width: bb.width, height: bb.height } });
  }
  await page.evaluate((boxes) => {
    const wrap = document.createElement("div");
    wrap.id = "__marks";
    wrap.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none";
    for (const b of boxes) {
      const pad = b.pad ?? 4;
      const x = b.bb.x - pad, y = b.bb.y - pad, w = b.bb.width + pad * 2, h = b.bb.height + pad * 2;
      const box = document.createElement("div");
      box.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:3px solid #E5252A;border-radius:10px;box-sizing:border-box;background:rgba(229,37,42,.06)`;
      const dot = document.createElement("div");
      dot.textContent = b.n;
      const S = 26;
      const pos = {
        tl: [x - S / 2, y - S / 2], tr: [x + w - S / 2, y - S / 2], bl: [x - S / 2, y + h - S / 2], br: [x + w - S / 2, y + h - S / 2],
        l: [x - S - 4, y + h / 2 - S / 2], r: [x + w + 4, y + h / 2 - S / 2], t: [x + w / 2 - S / 2, y - S - 4], b: [x + w / 2 - S / 2, y + h + 4],
      }[b.at ?? "tl"];
      dot.style.cssText = `position:absolute;left:${pos[0]}px;top:${pos[1]}px;width:${S}px;height:${S}px;border-radius:50%;background:#E5252A;color:#fff;font:700 15px Arial,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
      wrap.append(box, dot);
    }
    document.body.append(wrap);
  }, boxes);
}
const unmark = () => page.evaluate(() => document.getElementById("__marks")?.remove());

async function shot(name, opts = {}) {
  const { marks = [], full = false, clip, pad = 16, vp = false } = opts;
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(150);
  if (marks.length) await mark(marks);
  let clipBox;
  if (clip) {
    if (clip.boundingBox) {
      const bb = await clip.first().boundingBox();
      const [sx, sy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
      clipBox = { x: Math.max(0, bb.x + sx - pad), y: Math.max(0, bb.y + sy - pad), width: bb.width + pad * 2, height: bb.height + pad * 2 };
    } else clipBox = clip;
  }
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: !vp && (full || !!clip), ...(clipBox ? { clip: clipBox } : {}) });
  if (marks.length) await unmark();
  console.log("  captura", name);
}
const L = (sel, opt) => page.locator(sel, opt);
const nav = (label) => L("aside a", { hasText: label });
const group = (label) => L("aside button", { hasText: label });
const section = (title) => L("main section", { has: page.getByRole("heading", { name: title, exact: true }) });
const PERIOD = "/desempeno?periodo=custom&desde=2026-09-25&hasta=2026-10-22";

// Acceso como ADMINISTRADOR (usuario local de ejemplo)
await go("/login");
await page.fill("#email", "admin@311consultores.com");
await page.fill("#password", "TeamDemo2026");
await page.click("form button.btn");
await page.waitForURL(BASE + "/");
await ready();
await ctx.addCookies([{ name: "venc_cierre", value: new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date()), url: BASE }]);

// 1. Menú
console.log("Menu");
await go("/");
await group("Administración").click().catch(() => {});
await page.setViewportSize({ width: 1440, height: 800 });
await page.waitForTimeout(300);
if (!(await nav("Desempeño").isVisible())) await group("Administración").click();
await group("Configuración").click().catch(() => {});
await page.waitForTimeout(300);
await shot("a01-menu", {
  clip: { x: 0, y: 0, width: 300, height: 800 },
  marks: [
    { loc: nav("Facturas"), n: 1, at: "r" },
    { loc: nav("Finanzas"), n: 2, at: "r" },
    { loc: nav("Desempeño"), n: 3, at: "r" },
    { loc: nav("General"), n: 4, at: "r" },
    { loc: nav("Log"), n: 5, at: "r" },
    { loc: nav("Usuarios"), n: 6, at: "r" },
    { loc: nav("App y avisos"), n: 7, at: "r" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });

// 2. Dashboard: filtros y resumen
console.log("Desempeño");
await go(PERIOD);
await page.waitForSelector("text=Resumen del equipo");
await shot("a02-resumen", {
  clip: { x: 256, y: 0, width: 1184, height: 900 },
  marks: [
    { loc: L("main form").first(), n: 1, at: "t" },
    { loc: L("#f-periodo"), n: 2, at: "b" },
    { loc: L("#f-persona"), n: 3, at: "b" },
    { loc: L("#f-area"), n: 4, at: "b" },
    { loc: section("Resumen del equipo").locator("div.grid > div").first(), n: 5, at: "tr" },
    { loc: section("Resumen del equipo").locator("div.grid > div").nth(6), n: 6, at: "tr" },
  ],
});

await section("Embudo de tareas").scrollIntoViewIfNeeded();
await shot("a03-embudo-tendencia", {
  clip: { x: 256, y: await page.evaluate(() => { const h = [...document.querySelectorAll("main h2")].find((e) => e.textContent === "Embudo de tareas"); return h.getBoundingClientRect().top + window.scrollY - 30; }), width: 1184, height: 800 },
  marks: [
    { loc: section("Embudo de tareas").locator("div.card"), n: 1, at: "tl" },
    { loc: section("Tendencia").locator("div.flex").first(), n: 2, at: "l" },
    { loc: section("Tendencia").locator("figure"), n: 3, at: "tl" },
  ],
});

await section("Por persona").scrollIntoViewIfNeeded();
await shot("a04-personas", {
  clip: await section("Por persona").boundingBox().then(async (bb) => { const sy = await page.evaluate(() => window.scrollY); return { x: 256, y: bb.y + sy - 16, width: 1184, height: bb.height + 40 }; }),
  marks: [
    { loc: section("Por persona").locator("tbody tr").first().locator("a"), n: 1, at: "tl" },
    { loc: section("Por persona").locator("tbody tr").first().locator("td").nth(3), n: 2, at: "t" },
    { loc: section("Por persona").locator("tbody tr").nth(1).locator("td").nth(3), n: 3, at: "b" },
    { loc: section("Por persona").locator("tbody tr").first().locator("td").nth(5), n: 4, at: "t" },
  ],
});

await section("Calidad de la gestión").scrollIntoViewIfNeeded();
await shot("a05-gestion", {
  clip: await section("Calidad de la asignación").boundingBox().then(async (bb) => { const sy = await page.evaluate(() => window.scrollY); return { x: 256, y: bb.y + sy - 16, width: 1184, height: 520 }; }),
  marks: [
    { loc: section("Calidad de la asignación").locator("div.grid"), n: 1, at: "tl" },
    { loc: section("Calidad de la gestión").locator("table"), n: 2, at: "tl" },
  ],
});

await section("Exportar a Excel (CSV)").scrollIntoViewIfNeeded();
await shot("a06-exportar-config", {
  clip: await section("Exportar a Excel (CSV)").boundingBox().then(async (bb) => { const sy = await page.evaluate(() => window.scrollY); return { x: 256, y: bb.y + sy - 16, width: 1184, height: 430 }; }),
  marks: [
    { loc: section("Exportar a Excel (CSV)").locator("div.flex"), n: 1, at: "tl" },
    { loc: L("#c-green"), n: 2, at: "t" },
    { loc: L("#c-amber"), n: 3, at: "t" },
    { loc: L("#c-since"), n: 4, at: "t" },
    { loc: section("Configuración del semáforo y de la medición").locator("button[type=submit]"), n: 5, at: "r" },
  ],
});

// 3. Ficha individual
console.log("Ficha");
await go(PERIOD);
await L("main a", { hasText: "Ana Pérez" }).first().click();
await page.waitForSelector("text=Entrega de tareas");
await ready();
await shot("a07-ficha", {
  clip: { x: 256, y: 0, width: 1184, height: 1640 },
  full: true,
  marks: [
    { loc: L("main h1"), n: 1, at: "l" },
    { loc: L("main section").first().locator("div.grid > div").first(), n: 2, at: "tr" },
    { loc: L("main section").first().locator("div.grid > div").nth(2), n: 3, at: "tr" },
    { loc: section("Tendencia").locator("figure"), n: 4, at: "tl" },
    { loc: section("Tareas entregadas en el periodo").locator("table"), n: 5, at: "tl" },
  ],
});

// 4. Áreas en Configuración
console.log("Áreas");
await go("/configuracion");
await shot("a08-areas", {
  clip: await section("Áreas del equipo").boundingBox().then(async (bb) => { const sy = await page.evaluate(() => window.scrollY); return { x: 256, y: bb.y + sy - 16, width: 900, height: bb.height + 40 }; }),
  marks: [
    { loc: section("Áreas del equipo").locator("ul li").first(), n: 1, at: "tl" },
    { loc: section("Áreas del equipo").locator("ul li").first().locator("button", { hasText: "Editar" }), n: 2, at: "t" },
    { loc: section("Áreas del equipo").locator("ul li").first().locator("button", { hasText: "Desactivar" }), n: 3, at: "t" },
    { loc: section("Áreas del equipo").locator("form").last().locator("input[name=name]"), n: 4, at: "t" },
    { loc: section("Áreas del equipo").locator("form").last().locator("button[type=submit]"), n: 5, at: "r" },
  ],
});

// 5. Usuarios: pestañas, rol y áreas
console.log("Usuarios");
await go("/usuarios");
const anaRow = L("tbody tr", { hasText: "Ana Pérez" });
await anaRow.locator("button", { hasText: "Editar" }).click();
await page.waitForSelector("[role=dialog] select[name=role]");
await page.setViewportSize({ width: 1440, height: 1500 });
await page.waitForTimeout(500);
const ub = await L("[role=dialog] > div").boundingBox();
await shot("a09-editar-usuario", {
  vp: true, clip: { x: Math.max(0, ub.x - 30), y: Math.max(0, ub.y - 20), width: ub.width + 60, height: ub.height + 40 },
  marks: [
    { loc: L("[role=dialog] select[name=role]"), n: 1, at: "t" },
    { loc: L("[role=dialog] input[name=email]"), n: 2, at: "t" },
    { loc: L("[role=dialog] input[name=phone]"), n: 3, at: "t" },
    { loc: L("[role=dialog] input[name=areaIds]").first().locator("xpath=ancestor::div[1]"), n: 4, at: "tl" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.keyboard.press("Escape");

// 6. Tareas con área
console.log("Tareas");
await go("/tareas");
await page.waitForSelector("section[aria-label='PENDIENTE'] article");
await shot("a10-tareas-area", {
  clip: { x: 256, y: 0, width: 1184, height: 620 },
  marks: [
    { loc: L("select[aria-label='Filtrar por área']"), n: 1, at: "t" },
    { loc: L("article span.rounded-full.text-white").first(), n: 2, at: "tr", pad: 2 },
  ],
});
await L("button.btn", { hasText: "Nueva tarea" }).click();
await page.waitForSelector("[role=dialog] #t-area");
await page.selectOption("#t-area", { label: "DISEÑO" });
await page.setViewportSize({ width: 1440, height: 1300 });
await page.waitForTimeout(400);
const nb = await L("[role=dialog] > div").boundingBox();
await shot("a11-nueva-tarea-area", {
  vp: true, clip: { x: Math.max(0, nb.x - 30), y: Math.max(0, nb.y - 20), width: nb.width + 60, height: Math.min(nb.height + 40, 640) },
  marks: [{ loc: L("#t-area"), n: 1, at: "t" }],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.keyboard.press("Escape");

// 7. Log
console.log("Log");
await go("/eliminaciones");
await shot("a12-log", {
  clip: { x: 256, y: 0, width: 1184, height: 760 },
  marks: [
    { loc: L("main h2", { hasText: "Solicitudes de edición pendientes" }), n: 1, at: "l" },
    { loc: L("main h2", { hasText: "Solicitudes de eliminación pendientes" }), n: 2, at: "l" },
  ],
});

await browser.close();
console.log("Listo");
