// Capturas del manual del PROJECT 311 (carpeta capturas/project). Requiere: servidor local en :3000 y los datos de ejemplo (seed-demo.ts).
// No borra las capturas del manual del Editor.
import fs from "node:fs";
import path from "node:path";
import { launch, SHOTS } from "./lib.mjs";

const BASE = "http://localhost:3000";
const OUT = path.join(SHOTS, "project");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "es-MX", colorScheme: "light", timezoneId: "America/Mexico_City" });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

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

// Acceso: el PROJECT 311 aterriza directo en Tareas
await go("/login");
await page.fill("#email", "paula.proyectos@ejemplo.test");
await page.fill("#password", "TeamDemo2026");
await page.click("form button.btn");
await page.waitForURL(BASE + "/tareas");
await ready();
await page.waitForSelector("section[aria-label='PENDIENTE'] article");

// 1. Menú
console.log("Menu");
await group("Configuración").click().catch(() => {});
await page.setViewportSize({ width: 1440, height: 760 });
await page.waitForTimeout(300);
await shot("p01-menu", {
  clip: { x: 0, y: 0, width: 300, height: 760 },
  marks: [
    { loc: nav("Tareas"), n: 1, at: "r" },
    { loc: nav("Baúl"), n: 2, at: "r" },
    { loc: nav("Clientes y proyectos"), n: 3, at: "r" },
    { loc: nav("App y avisos"), n: 4, at: "r" },
    { loc: L("aside a[href='/perfil']"), n: 5, at: "r" },
    { loc: L("aside button[aria-label^='Avisos']"), n: 6, at: "t", pad: 0 },
    { loc: L("aside form button"), n: 7, at: "bl" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);

// 2. Tablero
console.log("Tablero");
await go("/tareas");
await page.waitForSelector("section[aria-label='PENDIENTE'] article");
await shot("p02-tablero", {
  clip: { x: 256, y: 0, width: 1184, height: 760 },
  marks: [
    { loc: L("main button.btn", { hasText: "Nueva tarea" }), n: 1, at: "t" },
    { loc: L("input[aria-label='Buscar tareas']"), n: 2, at: "t" },
    { loc: L("[aria-label=Vista]"), n: 3, at: "t" },
    { loc: L("select[aria-label='Filtrar por persona']"), n: 4, at: "t" },
    { loc: L("section[aria-label='PENDIENTE'] > header"), n: 5, at: "tl" },
    { loc: L("article", { hasText: "Actualizar inventario" }), n: 6, at: "tr" },
    { loc: L("section[aria-label='PARA REVISAR'] > header"), n: 7, at: "tl" },
    { loc: L("a", { hasText: "Historial" }).last(), n: 8, at: "t" },
  ],
});

// 3. Nueva tarea: se puede asignar a cualquier persona del equipo
console.log("Nueva tarea");
await L("button.btn", { hasText: "Nueva tarea" }).click();
await page.waitForSelector("[role=dialog] select");
await page.setViewportSize({ width: 1440, height: 1500 });
await page.selectOption("#t-client", { label: "Constructora Horizonte" });
await page.selectOption("#t-project", { label: "Torre Norte" });
await page.fill("#t-title", "Preparar la junta con el cliente");
await page.locator("[role=dialog] input[placeholder^='Escribe para buscar']").click();
await page.waitForSelector("[role=dialog] ul.glass li button");
await page.waitForTimeout(300);
const newBox = await L("[role=dialog] > div").boundingBox();
await shot("p03-nueva-tarea", {
  vp: true, clip: { x: Math.max(0, newBox.x - 30), y: Math.max(0, newBox.y - 20), width: newBox.width + 60, height: newBox.height + 40 },
  marks: [
    { loc: L("#t-client"), n: 1, at: "t" },
    { loc: L("#t-project"), n: 2, at: "t" },
    { loc: L("[role=dialog] input[placeholder^='Escribe para buscar']"), n: 3, at: "r" },
    { loc: L("[role=dialog] ul.glass"), n: 4, at: "r" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");

// 4. Detalle de una tarea: editar, mover y solicitar eliminación
console.log("Detalle");
await go("/tareas");
await L("article", { hasText: "Entregar reporte de recorrido" }).click();
await page.waitForSelector("[role=dialog] aside");
await page.setViewportSize({ width: 1440, height: 1500 });
await page.waitForTimeout(800);
const detBox = await L("[role=dialog] > div").boundingBox();
await shot("p04-detalle", {
  vp: true, clip: { x: Math.max(0, detBox.x - 30), y: Math.max(0, detBox.y - 20), width: detBox.width + 60, height: detBox.height + 40 },
  marks: [
    { loc: L("[role=dialog] h3", { hasText: "Subtareas" }), n: 1, at: "l" },
    { loc: L("[role=dialog] h3", { hasText: "Comentarios" }), n: 2, at: "l" },
    { loc: L("[role=dialog] select#mover-a"), n: 3, at: "l" },
    { loc: L("[role=dialog] aside button", { hasText: "Editar" }), n: 4, at: "b" },
    { loc: L("[role=dialog] aside button", { hasText: "Solicitar eliminación" }), n: 5, at: "b" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.keyboard.press("Escape");

// 5. Aceptar una tarea que está para revisar
console.log("Aceptar");
await go("/tareas");
await L("article", { hasText: "Entregar reporte de recorrido" }).dragTo(L("section[aria-label='TERMINADA']"));
await page.waitForSelector("text=Aceptar la tarea");
await page.fill("#accept-note", "¡Buen trabajo! Quedó muy claro.");
await shot("p05-aceptar", {
  vp: true, clip: { x: 360, y: 200, width: 720, height: 460 },
  marks: [
    { loc: L("#accept-note"), n: 1, at: "r" },
    { loc: L("[role=dialog] input[type=checkbox]"), n: 2, at: "l" },
    { loc: L("[role=dialog] button", { hasText: "Aceptar tarea" }), n: 3, at: "t" },
  ],
});
await page.keyboard.press("Escape");

// 6. Clientes y proyectos (solo lectura)
console.log("Clientes");
await go("/clientes");
await page.waitForSelector("article");
await shot("p06-clientes", {
  clip: { x: 256, y: 0, width: 1184, height: 560 },
  marks: [
    { loc: L("input[placeholder^='Buscar cliente']"), n: 1, at: "r" },
    { loc: L("article").first(), n: 2, at: "tl" },
    { loc: L("article button[aria-label='Ver detalles del cliente'], article [aria-label='Ver detalles del cliente']").first(), n: 3, at: "b" },
  ],
});

// 7. Mi perfil
console.log("Perfil");
await go("/perfil");
await shot("p07-perfil", {
  clip: { x: 256, y: 0, width: 900, height: 520 },
  marks: [
    { loc: L("main section").first().locator("img, span").first(), n: 1, at: "l" },
    { loc: L("select[name=birthMonth]"), n: 2, at: "t" },
    { loc: L("main button[type=submit]"), n: 3, at: "t" },
  ],
});

await browser.close();
console.log("Listo");
