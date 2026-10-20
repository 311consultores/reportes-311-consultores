// Toma las capturas del manual con marcas numeradas. Requiere: servidor local en :3000 y datos de ejemplo (seed-demo.ts)
import fs from "node:fs";
import path from "node:path";
import { launch, ROOT, SHOTS, ASSETS } from "./lib.mjs";

const BASE = "http://localhost:3000";
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "..", ".env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const TODAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date());

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "es-MX", colorScheme: "light", timezoneId: "America/Mexico_City" });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

// ---------- utilidades ----------
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

/** Dibuja recuadros rojos numerados sobre los elementos indicados. items: { loc, n, at?, pad? } */
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

/** Toma una captura. opts: marks, full, clip (Locator | {x,y,width,height} en coordenadas de documento), vp (recorte de la ventana visible: ventanas emergentes) */
async function shot(name, opts = {}) {
  const { marks = [], full = false, clip, pad = 16, vp = false } = opts;
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {}); // fotos y logos cargados
  await page.waitForTimeout(150);
  if (marks.length) await mark(marks);
  const file = path.join(SHOTS, name + ".png");
  let clipBox;
  if (clip) {
    if (clip.boundingBox) {
      const bb = await clip.first().boundingBox();
      const [sx, sy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
      clipBox = { x: Math.max(0, bb.x + sx - pad), y: Math.max(0, bb.y + sy - pad), width: bb.width + pad * 2, height: bb.height + pad * 2 };
    } else clipBox = clip;
  }
  await page.screenshot({ path: file, fullPage: !vp && (full || !!clip), ...(clipBox ? { clip: clipBox } : {}) });
  if (marks.length) await unmark();
  console.log("  captura", name);
}
const L = (sel, opt) => page.locator(sel, opt);
const T = (text, opt) => page.getByText(text, opt);

async function login(email, password) {
  await go("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("form button.btn");
  await page.waitForURL(BASE + "/");
  await ready();
}
const hideBanner = () => ctx.addCookies([{ name: "venc_cierre", value: TODAY, url: BASE }]);
const showBanner = () => ctx.clearCookies({ name: "venc_cierre" });
const nav = (label) => L("aside a", { hasText: label });
const group = (label) => L("aside button", { hasText: label });

// ---------- 1. Acceso ----------
console.log("Acceso");
await go("/login");
await shot("01-login", {
  clip: { x: 340, y: 150, width: 760, height: 600 },
  marks: [
    { loc: "#email", n: 1 },
    { loc: "#password", n: 2 },
    { loc: "#password ~ button", n: 3, at: "tr", pad: 2 },
    { loc: L("form button.btn"), n: 4 },
    { loc: T("¿Olvidaste tu contraseña?"), n: 5 },
  ],
});
await go("/recuperar");
await shot("02-recuperar", { clip: { x: 340, y: 180, width: 760, height: 560 }, marks: [{ loc: L("input[type=email], input[name=email]"), n: 1 }, { loc: L("form button.btn"), n: 2 }] });

await login("editor@311consultores.com", env.SEED_EDITOR_PASSWORD);
await hideBanner();

// ---------- 2. Menú ----------
console.log("Menu");
await go("/");
await group("Administración").click();
await group("Configuración").click();
await page.setViewportSize({ width: 1440, height: 760 });
await page.waitForTimeout(300);
await shot("03-menu", {
  clip: { x: 0, y: 0, width: 300, height: 760 },
  marks: [
    { loc: group("Operación"), n: 1, at: "r", pad: 2 },
    { loc: nav("Tareas"), n: 2, at: "r" },
    { loc: nav("Reportes"), n: 3, at: "r" },
    { loc: nav("Clientes y proyectos"), n: 4, at: "r" },
    { loc: nav("Registro de clientes"), n: 5, at: "r" },
    { loc: group("Administración"), n: 6, at: "r", pad: 2 },
    { loc: nav("Facturas"), n: 7, at: "r" },
    { loc: group("Configuración"), n: 8, at: "r", pad: 2 },
    { loc: nav("Usuarios"), n: 9, at: "r" },
    { loc: L("aside form button"), n: 10, at: "bl" },
    { loc: L("aside button[aria-label^='Avisos']"), n: 11, at: "t", pad: 0 },
    { loc: L("aside button[aria-label*='modo']"), n: 12, at: "t", pad: 0 },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);

// ---------- 3. Lista de reportes ----------
console.log("Lista");
await go("/");
await shot("04-lista", {
  clip: { x: 0, y: 0, width: 1440, height: 560 },
  marks: [
    { loc: L("input[placeholder^='Buscar']"), n: 1 },
    { loc: L("a.btn", { hasText: "Nuevo reporte" }), n: 2 },
    { loc: L("main a", { hasText: /^Todos$/ }), n: 3, at: "tl" },
    { loc: L("select[aria-label=Periodo]"), n: 4 },
    { loc: L("th a", { hasText: "Folio" }), n: 5, at: "t" },
    { loc: L("td a", { hasText: "HRZ003091026" }), n: 6 },
    { loc: L("tbody tr", { hasText: "HRZ003091026" }).locator("td").last(), n: 7, at: "r" },
  ],
});
await page.fill("input[placeholder^='Buscar']", "Aurora");
await page.waitForSelector("text=CSA00");
await page.waitForTimeout(400);
await shot("05-busqueda", { clip: { x: 0, y: 0, width: 1440, height: 560 }, marks: [{ loc: L("input[placeholder^='Buscar']"), n: 1 }, { loc: L("div.glass button").first(), n: 2, at: "r" }] });
await page.keyboard.press("Escape");

await go("/");
await page.selectOption("select[aria-label=Periodo]", "rango");
await page.fill("input[aria-label='Fecha inicial']", "2026-09-20");
await page.fill("input[aria-label='Fecha final']", "2026-09-25");
await shot("06-periodo", {
  clip: { x: 256, y: 0, width: 1184, height: 230 },
  marks: [
    { loc: L("select[aria-label=Periodo]"), n: 1 },
    { loc: L("input[aria-label='Fecha inicial']"), n: 2 },
    { loc: L("input[aria-label='Fecha final']"), n: 3 },
    { loc: L("button.btn", { hasText: "Aplicar" }), n: 4 },
  ],
});
await go("/?status=RECHAZADO");
await shot("07-filtro", { clip: { x: 256, y: 0, width: 1184, height: 300 }, marks: [{ loc: L("main a", { hasText: /^Rechazado$/ }), n: 1, at: "t" }, { loc: L("p.meta").first(), n: 2, at: "r" }] });
await go("/?sort=folio&dir=asc");
await shot("08-ordenar", { clip: { x: 0, y: 0, width: 1440, height: 560 }, marks: [{ loc: L("th a", { hasText: "Folio" }), n: 1, at: "t" }] });

// ---------- 4. Nuevo reporte ----------
console.log("Nuevo reporte");
await go("/reportes/nuevo");
await page.fill("input[role=combobox]", "Hori");
await page.locator("ul[role=listbox] li", { hasText: "Constructora Horizonte" }).click();
await page.selectOption("select[name=projectId]", { label: "Torre Norte" });
await page.fill("input[name=startDate]", "2026-10-12");
const picker = L("input[placeholder^='Escribe para buscar y agregar']");
await picker.click();
await page.locator("ul.glass li", { hasText: "Ana Pérez" }).locator("button").click();
await picker.click();
await page.locator("ul.glass li", { hasText: "Luis Gómez" }).locator("button").click();
await page.locator("h1").click(); // cierra la lista
await page.waitForTimeout(300);
await shot("09-nuevo-reporte", {
  clip: { x: 256, y: 0, width: 1184, height: 760 },
  marks: [
    { loc: L("input[role=combobox]"), n: 1 },
    { loc: L("select[name=projectId]"), n: 2 },
    { loc: L("input[name=startDate]"), n: 3 },
    { loc: L("input[name=endDate]"), n: 4 },
    { loc: L("main span.rounded-full", { hasText: "Ana Pérez" }).first(), n: 5, at: "tl" },
    { loc: picker, n: 6 },
    { loc: L("form button.btn"), n: 7 },
  ],
});

// ---------- 5. Reporte ----------
console.log("Reporte");
const reportHref = async (folio) => {
  await go("/?periodo=todo");
  return page.locator("td a", { hasText: folio }).getAttribute("href");
};
const hProceso = await reportHref("HRZ003091026");
const hTerminado = await reportHref("CSA002091026");
const hRechazado = await reportHref("CSA001071026");
const hAprobado = await reportHref("HRZ002290926");
const hEnviado = await reportHref("HRZ001220926");

await go(hProceso);
await shot("10-reporte", {
  clip: { x: 256, y: 0, width: 1184, height: 580 },
  marks: [
    { loc: L("a", { hasText: "Reportes" }).filter({ has: page.locator("svg") }).last(), n: 1, at: "r" },
    { loc: L("h1.page-title"), n: 2 },
    { loc: L("[class*='rounded-full']", { hasText: "En proceso" }), n: 3, at: "l" },
    { loc: L("dl"), n: 4, at: "b" },
    { loc: L("button.btn", { hasText: "Marcar como terminado" }), n: 5 },
    { loc: L("a", { hasText: "Ver PDF" }), n: 6, at: "b" },
    { loc: L("button", { hasText: "Solicitar eliminación del reporte" }), n: 7, at: "r" },
  ],
});

const act3 = L("section .card").nth(2);
await act3.getByRole("button", { name: "Editar título de la actividad" }).click();
await page.keyboard.type("Seguimiento semanal");
await page.keyboard.press("Enter");
await act3.getByLabel("Indicar fecha y hora de ejecución").check();
await act3.locator("input[type=date]").fill("2026-10-08");
await act3.locator("input[type=time]").fill("11:30");
await page.locator(".ProseMirror:visible").click();
await page.keyboard.type("Se revisó el avance de la semana con el equipo del cliente.");
await page.waitForTimeout(400);
await shot("11-actividad-escribiendo", {
  clip: L("section").first(),
  pad: 10,
  marks: [
    { loc: L("button.btn", { hasText: "Agregar actividad" }), n: 1, at: "tl" },
    { loc: L("section .card").nth(2).locator("button[aria-expanded]"), n: 2, at: "l" },
    { loc: act3.getByRole("button", { name: "Editar título de la actividad" }), n: 3, at: "r" },
    { loc: act3.getByLabel("Indicar fecha y hora de ejecución"), n: 4, at: "l" },
    { loc: act3.locator("input[type=date]"), n: 5, at: "b" },
    { loc: act3.locator("div.border-y"), n: 6, at: "tl" },
    { loc: L(".ProseMirror:visible"), n: 7 },
    { loc: act3.getByText(/Guardando|Guardado/), n: 8, at: "b" },
  ],
});
await page.waitForTimeout(2600);
await shot("12-guardado", { clip: L("section .card").nth(2).locator("div").first(), pad: 22, marks: [{ loc: L("section .card").nth(2).getByText("Guardado"), n: 1, at: "b" }] });

await page.locator("section .card").nth(0).locator("button[aria-expanded]").click();
await page.waitForTimeout(500);
await shot("13-evidencias", {
  clip: L("section").first(),
  pad: 10,
  marks: [
    { loc: L("section .card").nth(0).locator("button[aria-expanded]"), n: 1, at: "l" },
    { loc: L("section .card").nth(0).locator("ul.grid li").first(), n: 2 },
    { loc: L("section .card").nth(0).locator("ul.grid li button").first(), n: 3, at: "bl" },
    { loc: L("button", { hasText: "Adjuntar evidencia" }).first(), n: 4 },
    { loc: L("section .card").nth(0).getByText(/de 3/), n: 5, at: "r" },
  ],
});
const fileChooser = page.waitForEvent("filechooser");
await page.locator("section .card").nth(0).getByRole("button", { name: /Adjuntar evidencia/ }).click();
(await fileChooser).setFiles(path.join(ASSETS, "foto-3.jpg"));
await page.locator("section .card").nth(0).getByText("3 de 3").waitFor({ timeout: 20000 });
await page.waitForTimeout(500);
await shot("14-evidencia-subida", { clip: L("section .card").nth(0), pad: 8, marks: [{ loc: L("section .card").nth(0).getByText("3 de 3"), n: 1, at: "r" }, { loc: L("section .card").nth(0).locator("button[disabled]").first(), n: 2, at: "t" }] });

await page.locator("details summary", { hasText: "Historial de cambios" }).click();
await page.waitForTimeout(300);
await shot("15-historial", { clip: L("details", { hasText: "Historial de cambios" }), pad: 10, marks: [{ loc: L("summary", { hasText: "Historial de cambios" }), n: 1, at: "l" }] });

await L("section .card").nth(1).getByRole("button", { name: /Solicitar eliminación/ }).click();
await page.waitForSelector("[role=dialog] textarea");
await page.fill("[role=dialog] textarea", "La actividad se capturó por error y ya existe en otro reporte.");
await shot("16-solicitar-eliminacion", {
  vp: true, clip: { x: 260, y: 230, width: 920, height: 480 },
  marks: [{ loc: L("[role=dialog] textarea"), n: 1 }, { loc: L("[role=dialog] button", { hasText: "Enviar solicitud" }), n: 2 }, { loc: L("[role=dialog] button", { hasText: "Cancelar" }), n: 3 }],
});
await page.locator("[role=dialog] button", { hasText: "Cancelar" }).click();

// Terminado con solicitud de edición de un TEAM 311
await go(hTerminado);
await shot("17-terminado", {
  clip: { x: 256, y: 0, width: 1184, height: 760 },
  marks: [
    { loc: L("[class*='rounded-full']", { hasText: "Terminado" }), n: 1, at: "l" },
    { loc: L("div.card", { hasText: "solicita permiso para editar" }).last(), n: 2, at: "tl" },
    { loc: L("button.btn", { hasText: "Aprobar" }), n: 3, at: "b" },
    { loc: L("button", { hasText: /^Rechazar$/ }).last(), n: 4, at: "b" },
  ],
});
await go(hRechazado);
await shot("18-rechazado", {
  clip: { x: 256, y: 0, width: 1184, height: 640 },
  marks: [
    { loc: L("[class*='rounded-full']", { hasText: "Rechazado" }), n: 1, at: "l" },
    { loc: L("p", { hasText: "Motivo del rechazo" }), n: 2, at: "b" },
    { loc: L("button.btn", { hasText: "Marcar como terminado" }), n: 3, at: "b" },
  ],
});
await go(hAprobado);
await shot("19-aprobado", {
  clip: { x: 256, y: 0, width: 1184, height: 560 },
  marks: [
    { loc: L("[class*='rounded-full']", { hasText: "Aprobado" }), n: 1, at: "l" },
    { loc: L("button.btn", { hasText: "Enviar por correo" }), n: 2, at: "b" },
    { loc: L("a", { hasText: "Ver PDF" }), n: 3, at: "b" },
  ],
});
await page.getByRole("button", { name: /Enviar por correo/ }).click();
await page.waitForSelector("[role=dialog]");
await shot("20-confirmar-envio", { vp: true, clip: { x: 260, y: 270, width: 920, height: 400 }, marks: [{ loc: L("[role=dialog] button", { hasText: /^Enviar$/ }), n: 1 }, { loc: L("[role=dialog] button", { hasText: "Cancelar" }), n: 2 }] });
await page.locator("[role=dialog] button", { hasText: "Cancelar" }).click();
await go(hEnviado);
await shot("21-enviado", { clip: { x: 256, y: 0, width: 1184, height: 520 }, marks: [{ loc: L("[class*='rounded-full']", { hasText: "Enviado" }), n: 1, at: "l" }] });

// PDF del reporte (se dibuja con pdf.js porque el navegador sin pantalla no muestra visor)
{
  const id = hProceso.split("/").pop();
  const res = await ctx.request.get(`${BASE}/api/reports/${id}/pdf`);
  const buf = await res.body();
  if (buf.subarray(0, 4).toString() !== "%PDF") throw new Error("El PDF no se genero");
  const pdfjs = path.join(ROOT, "node_modules", "pdfjs-dist", "build");
  const p2 = await ctx.newPage();
  await p2.setContent("<html><body style='margin:0;background:#e5e7eb'><canvas id='c'></canvas></body></html>");
  await p2.addScriptTag({ content: fs.readFileSync(path.join(pdfjs, "pdf.min.js"), "utf8") });
  const worker = fs.readFileSync(path.join(pdfjs, "pdf.worker.min.js"), "utf8");
  await p2.evaluate(async ({ b64, worker }) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: "text/javascript" }));
    const doc = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise;
    const pg = await doc.getPage(1);
    const vp = pg.getViewport({ scale: 1.6 });
    const c = document.getElementById("c");
    c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  }, { b64: buf.toString("base64"), worker });
  await p2.setViewportSize({ width: 960, height: 1250 });
  await p2.locator("#c").screenshot({ path: path.join(SHOTS, "22-pdf.png") });
  await p2.close();
  console.log("  captura 22-pdf");
}

// ---------- 6. Facturas ----------
console.log("Facturas");
await showBanner();
await go("/facturas");
await shot("23-facturas", {
  clip: { x: 256, y: 0, width: 1184, height: 1250 },
  marks: [
    { loc: L("[role=alert]", { hasText: "vencid" }), n: 1, at: "tl" },
    { loc: L("main .grid.sm\\:grid-cols-2").first(), n: 2, at: "tl" },
    { loc: L("summary .btn"), n: 3, at: "r" },
    { loc: L("form[method=get]"), n: 4, at: "tl" },
    { loc: L("a.btn-outline", { hasText: "Exportar" }).or(L("a", { hasText: "Exportar a Excel" })), n: 5, at: "t" },
    { loc: L("tbody tr", { hasText: "A-2026-014" }).getByRole("button", { name: "Vencida" }), n: 6, at: "r" },
    { loc: L("tbody tr", { hasText: "A-2026-014" }).getByRole("link", { name: "Ver" }), n: 7, at: "l" },
  ],
});
await hideBanner();
await go("/facturas");
await L("summary .btn").click();
await page.fill("input[role=combobox]", "Hori");
await page.locator("ul[role=listbox] li", { hasText: "Constructora Horizonte" }).click();
await page.fill("input[name=description]", "servicios de consultoría — octubre 2026");
await page.fill("input[name=subtotal]", "10000");
await page.fill("input[name=dueDate]", "2026-11-30");
await page.fill("input[name=number]", "A-2026-016");
await page.waitForTimeout(300);
await shot("24-registrar-factura", {
  clip: L("details.card"),
  pad: 12,
  marks: [
    { loc: L("details.card label", { hasText: "Factura (con IVA)" }), n: 1, at: "tl" },
    { loc: L("details.card input[role=combobox]"), n: 2 },
    { loc: L("details.card input[readonly]").first(), n: 3 },
    { loc: L("details.card input[name=description]"), n: 4 },
    { loc: L("details.card input[name=subtotal]"), n: 5 },
    { loc: L("details.card input[readonly]").nth(1), n: 6 },
    { loc: L("details.card input[name=dueDate]"), n: 7 },
    { loc: L("details.card input[name=number]"), n: 8 },
    { loc: L("details.card input[name=isSoftware]"), n: 9, at: "l" },
    { loc: L("details.card button[type=submit]"), n: 10 },
  ],
});
await go("/facturas");
await L("tbody tr", { hasText: "A-2026-015" }).getByRole("button", { name: "Enviada" }).click();
await page.selectOption("[role=dialog] select", { label: "Triada · banco" });
await shot("25-marcar-pagada", {
  vp: true, clip: { x: 260, y: 230, width: 920, height: 480 },
  marks: [
    { loc: L("[role=dialog] select"), n: 1 },
    { loc: L("[role=dialog] input[type=date]"), n: 2 },
    { loc: L("[role=dialog] button", { hasText: "Marcar como pagada" }), n: 3 },
    { loc: L("[role=dialog] button", { hasText: "Cancelar" }), n: 4 },
  ],
});
await page.locator("[role=dialog] button", { hasText: "Cancelar" }).click();
await go("/facturas");
await L("tbody tr", { hasText: "A-2026-015" }).getByRole("link", { name: "Ver" }).click();
await page.waitForURL(/facturas\/[0-9a-f-]{36}/);
await ready();
await shot("26-detalle-factura", {
  clip: { x: 256, y: 0, width: 1184, height: 1040 },
  marks: [
    { loc: L("main .card button", { hasText: "Enviada" }), n: 1, at: "l" },
    { loc: L("main dl").first(), n: 2, at: "b" },
    { loc: L("main button", { hasText: "Solicitar eliminación" }).first(), n: 3, at: "b" },
    { loc: L("section.card", { hasText: "Corregir datos" }), n: 4, at: "tl" },
    { loc: L("details.card"), n: 5, at: "tl" },
  ],
});
await go("/facturas/datos-bancarios");
await shot("27-datos-bancarios", {
  clip: { x: 256, y: 0, width: 1184, height: 560 },
  marks: [
    { loc: L("main h2").first(), n: 1, at: "l" },
    { loc: L("button", { hasText: "Copiar todo" }).first(), n: 2, at: "t" },
    { loc: L("main dd button").first(), n: 3, at: "r" },
  ],
});

// ---------- 7. Clientes y proyectos ----------
console.log("Clientes");
await go("/clientes");
const horizonte = L("article", { hasText: "Constructora Horizonte" });
await horizonte.getByRole("button", { name: "Agregar proyecto" }).hover();
await page.waitForTimeout(350);
await shot("28-clientes", {
  clip: { x: 256, y: 0, width: 1184, height: 560 },
  marks: [
    { loc: L("button.btn", { hasText: "Nuevo cliente" }), n: 1, at: "t" },
    { loc: L("input[placeholder^='Buscar cliente']"), n: 2, at: "t" },
    { loc: horizonte.locator("header"), n: 3, at: "tl" },
    { loc: horizonte.locator("ul").first(), n: 4, at: "tl" },
    { loc: horizonte.getByRole("button", { name: "Ver detalles del cliente" }), n: 5, at: "b" },
    { loc: horizonte.getByRole("button", { name: "Agregar proyecto" }), n: 6, at: "b" },
    { loc: horizonte.getByRole("button", { name: "Datos fiscales y de contacto" }), n: 7, at: "b" },
    { loc: horizonte.getByRole("button", { name: /logo/ }), n: 8, at: "b" },
    { loc: horizonte.getByRole("button", { name: "Fusionar con otro cliente" }), n: 9, at: "b" },
  ],
});
await page.mouse.move(5, 5);
await L("button.btn", { hasText: "Nuevo cliente" }).click();
await page.waitForTimeout(300);
const newPanel = L("input[name=companyName]").locator("xpath=ancestor::div[contains(@class,'card')][1]");
await page.fill("input[name=companyName]", "Grupo Ejemplo del Norte");
await newPanel.locator("div.input input").fill("contacto@grupoejemplo.mx");
await page.keyboard.press("Enter");
await newPanel.locator("div.input input").fill("ventas@grupoejemplo.mx");
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
await shot("29-nuevo-cliente", {
  clip: newPanel,
  pad: 14,
  marks: [
    { loc: L("input[name=companyName]"), n: 1 },
    { loc: L("input[name=folioPrefix]"), n: 2 },
    { loc: newPanel.locator("div.input"), n: 3 },
    { loc: newPanel.locator("input[type=file]"), n: 4 },
    { loc: newPanel.locator("button[type=submit]"), n: 5 },
  ],
});
await L("button.btn", { hasText: "Nuevo cliente" }).click(); // plegar
await horizonte.getByRole("button", { name: "Ver detalles del cliente" }).click();
await page.waitForSelector("[role=dialog]");
await shot("30-cliente-detalle", {
  vp: true, clip: { x: 230, y: 40, width: 980, height: 820 },
  marks: [
    { loc: L("[role=dialog] img").first(), n: 1, at: "l" },
    { loc: L("[role=dialog] h3", { hasText: "Proyectos" }), n: 2, at: "l" },
    { loc: L("[role=dialog] h3", { hasText: "Datos fiscales" }), n: 3, at: "l" },
    { loc: L("[role=dialog] button[aria-label=Cerrar]"), n: 4, at: "b" },
  ],
});
await page.keyboard.press("Escape");
await horizonte.getByRole("button", { name: "Agregar proyecto" }).click();
await page.waitForSelector("[role=dialog] input[name=projectName]");
await shot("31-agregar-proyecto", {
  vp: true, clip: { x: 360, y: 110, width: 720, height: 600 },
  marks: [
    { loc: L("[role=dialog] input[name=projectName]"), n: 1 },
    { loc: L("[role=dialog] input[name=responsibleName]"), n: 2, at: "bl" },
    { loc: L("[role=dialog] input[name=responsibleLastName]"), n: 3, at: "br" },
    { loc: L("[role=dialog] div.input"), n: 4 },
    { loc: L("[role=dialog] button[type=submit]"), n: 5 },
  ],
});
await page.keyboard.press("Escape");
await horizonte.getByRole("button", { name: "Datos fiscales y de contacto" }).click();
await page.waitForSelector("[role=dialog]");
await page.waitForTimeout(300);
await page.setViewportSize({ width: 1440, height: 1900 }); // el formulario es alto: se amplía la ventana para que quepa completo
await page.waitForTimeout(400);
const fiscalBox = await L("[role=dialog] > div").boundingBox();
await shot("32-datos-fiscales", {
  vp: true, clip: { x: Math.max(0, fiscalBox.x - 30), y: Math.max(0, fiscalBox.y - 20), width: fiscalBox.width + 60, height: 1130 }, // solo la parte superior del formulario
  marks: [
    { loc: L("[role=dialog] details summary", { hasText: "Editar datos" }), n: 1, at: "l" },
    { loc: L("[role=dialog] input[name=requiresInvoice]"), n: 2, at: "l" },
    { loc: L("[role=dialog] input[name=rfc]"), n: 3 },
    { loc: L("[role=dialog] input[name=constancia]"), n: 4 },
    { loc: L("[role=dialog] div.input").first(), n: 5, at: "r" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.keyboard.press("Escape");
await L("article", { hasText: "Clínica Santa Aurora" }).getByRole("button", { name: /logo/ }).click();
await page.waitForSelector("[role=dialog] input[type=file]");
await shot("33-cambiar-logo", {
  vp: true, clip: { x: 360, y: 220, width: 720, height: 340 },
  marks: [{ loc: L("[role=dialog] input[type=file]"), n: 1 }, { loc: L("[role=dialog] button[type=submit]"), n: 2 }],
});
await page.keyboard.press("Escape");

// ---------- 8. Registro de clientes ----------
console.log("Registros");
await go("/registros");
await shot("34-registros", {
  clip: { x: 0, y: 0, width: 1440, height: 760 },
  marks: [
    { loc: L("text=Enlace de registro para clientes"), n: 1, at: "l" },
    { loc: L("button", { hasText: "Copiar enlace" }), n: 2, at: "t" },
    { loc: L("a", { hasText: "Abrir" }), n: 3, at: "t" },
    { loc: nav("Registro de clientes"), n: 4, at: "r" },
    { loc: L("a, button", { hasText: "Revisar" }).first(), n: 5, at: "l" },
  ],
});
await go("/registro");
await shot("35-registro-publico", {
  full: true,
  marks: [
    { loc: L("input[name=companyName]"), n: 1 },
    { loc: L("input[name=requiresInvoice]"), n: 2, at: "l" },
    { loc: L("input[name=contactName]"), n: 3 },
    { loc: L("input[name=billingName]"), n: 4 },
    { loc: L("form button.btn, button[type=submit]").last(), n: 5 },
  ],
});
await go("/registros");
await page.locator("a, button", { hasText: "Revisar" }).first().click();
await page.waitForURL(/\/registros\/.+/);
await ready();
await shot("36-revision-1", {
  clip: { x: 256, y: 0, width: 1184, height: 900 },
  marks: [
    { loc: L("img[alt='Logo enviado']"), n: 1, at: "l" },
    { loc: L("input[name=companyName]"), n: 2 },
    { loc: L("a", { hasText: /constancia|Ver PDF/i }).first(), n: 3, at: "r" },
    { loc: L("p", { hasText: "Posibles duplicados" }), n: 4, at: "l" },
  ],
});
await page.mouse.wheel(0, 2400);
await page.waitForTimeout(300);
const prefixBox = await L("input[name=folioPrefix]").locator("xpath=ancestor::fieldset").boundingBox();
const rejectBox = await L("button", { hasText: "Rechazar registro" }).boundingBox();
const [scx, scy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
await shot("37-revision-2", {
  clip: { x: Math.max(0, prefixBox.x + scx - 20), y: prefixBox.y + scy - 20, width: prefixBox.width + 40, height: rejectBox.y + rejectBox.height - prefixBox.y + 50 },
  marks: [
    { loc: L("input[name=folioPrefix]"), n: 1, at: "r" },
    { loc: L("button.btn", { hasText: "Aprobar y agregar al catálogo" }), n: 2 },
    { loc: L("button", { hasText: "Rechazar registro" }), n: 3 },
  ],
});
await page.getByRole("button", { name: "Rechazar registro" }).click();
await page.waitForSelector("[role=dialog] textarea");
await page.fill("[role=dialog] textarea", "Empresa duplicada: ya existe como cliente.");
await shot("38-rechazar-registro", { vp: true, clip: { x: 260, y: 230, width: 920, height: 480 }, marks: [{ loc: L("[role=dialog] textarea"), n: 1 }, { loc: L("[role=dialog] button", { hasText: /^Rechazar$/ }), n: 2 }, { loc: L("[role=dialog] button", { hasText: "Cancelar" }), n: 3 }] });
await page.locator("[role=dialog] button", { hasText: "Cancelar" }).click();

// ---------- 9. Usuarios (TEAM 311) ----------
console.log("Usuarios");
await go("/usuarios");
await shot("39-usuarios", {
  clip: { x: 256, y: 0, width: 1184, height: 520 },
  marks: [
    { loc: L("summary .btn"), n: 1, at: "r" },
    { loc: L("tbody tr", { hasText: "Ana Pérez" }).locator("td").first(), n: 2, at: "l" },
    { loc: L("tbody tr", { hasText: "Ana Pérez" }).getByRole("button", { name: "Editar" }), n: 3, at: "t" },
    { loc: L("tbody tr", { hasText: "Ana Pérez" }).getByRole("button", { name: "Desactivar" }), n: 4, at: "t" },
  ],
});
await L("summary .btn").click();
await page.fill("input[name=name]", "Daniela Fuentes");
await page.fill("input[name=email]", "daniela.fuentes@ejemplo.test");
await page.fill("input[name=password]", "ClaveDeEjemplo1");
await page.setInputFiles("input[type=file][name=photo]", path.join(ASSETS, "persona-ana.jpg"));
await page.getByRole("button", { name: "Aplicar" }).click(); // el recortador de foto
await page.waitForTimeout(300);
await page.selectOption("select[name=birthMonth]", "6");
await page.selectOption("select[name=birthDay]", "21");
await page.getByLabel("Torre Norte", { exact: true }).check();
await page.locator("fieldset", { has: page.locator("legend", { hasText: "Clínica Santa Aurora" }) }).getByLabel(/Todos los proyectos/).check();
await page.waitForTimeout(400);
await shot("40-nuevo-usuario", {
  clip: L("details.card"),
  pad: 14,
  marks: [
    { loc: L("details.card input[name=name]"), n: 1 },
    { loc: L("details.card input[name=email]"), n: 2 },
    { loc: L("details.card input[name=password]"), n: 3 },
    { loc: L("details.card input[readonly]"), n: 4 },
    { loc: L("details.card button", { hasText: /Cambiar foto|Subir foto/ }), n: 5 },
    { loc: L("details.card select[name=birthMonth]"), n: 6 },
    { loc: L("details.card fieldset", { hasText: "Constructora Horizonte" }), n: 7, at: "tl" },
    { loc: L("details.card button[type=submit]"), n: 8 },
  ],
});
await go("/usuarios");
await L("tbody tr", { hasText: "Luis Gómez" }).getByRole("button", { name: "Editar" }).click();
await page.waitForSelector("[role=dialog]");
await page.waitForTimeout(300);
await shot("41-editar-usuario", {
  vp: true, clip: { x: 230, y: 0, width: 980, height: 900 },
  marks: [
    { loc: L("[role=dialog] input[name=password]"), n: 1 },
    { loc: L("[role=dialog] button", { hasText: /Cambiar foto|Subir foto/ }), n: 2 },
    { loc: L("[role=dialog] select[name=birthMonth]"), n: 3 },
    { loc: L("[role=dialog] fieldset", { hasText: "Clínica Santa Aurora" }), n: 4, at: "tl" },
    { loc: L("[role=dialog] button[type=submit]"), n: 5 },
  ],
});
await page.keyboard.press("Escape");

// ---------- 10. Recortador de foto, fusión de clientes y cambio de cliente ----------
console.log("Recortador, fusión y cambio de cliente");
await L("tbody tr", { hasText: "Luis Gómez" }).getByRole("button", { name: "Editar" }).click();
await page.waitForSelector("[role=dialog]");
await page.locator("[role=dialog] input[type=file][name=photo]").setInputFiles(path.join(ASSETS, "persona-luis.jpg"));
await page.waitForSelector("[role=dialog] input[type=range]");
await page.locator("[role=dialog] input[type=range]").fill("1.6");
await page.waitForTimeout(400);
const crop = L("[role=dialog]").last();
await shot("42-recortar-foto", {
  vp: true, clip: { x: 320, y: 80, width: 800, height: 700 },
  marks: [
    { loc: crop.locator("div.touch-none"), n: 1, at: "l" },
    { loc: crop.locator("input[type=range]"), n: 2, at: "b" },
    { loc: crop.getByRole("button", { name: "Aplicar" }), n: 3, at: "t" },
  ],
});
await crop.getByRole("button", { name: "Cancelar" }).click();
await page.keyboard.press("Escape");

await go("/clientes");
await L("article", { hasText: "Constructora Horizonte" }).getByRole("button", { name: "Fusionar con otro cliente" }).click();
await page.waitForSelector("[role=dialog] select");
await page.selectOption("[role=dialog] select", { label: "Horizonte Construcciones (HZC)" });
await page.waitForTimeout(400);
await page.setViewportSize({ width: 1440, height: 1500 }); // la ventana es alta: se amplía para que quepa completa
await page.waitForTimeout(400);
const mergeBox = await L("[role=dialog] > div").boundingBox();
await shot("43-fusionar-clientes", {
  vp: true, clip: { x: Math.max(0, mergeBox.x - 30), y: Math.max(0, mergeBox.y - 20), width: mergeBox.width + 60, height: mergeBox.height + 40 },
  marks: [
    { loc: L("[role=dialog] select"), n: 1, at: "r" },
    { loc: L("[role=dialog] table tbody tr").nth(1).locator("td").nth(1), n: 2, at: "l" },
    { loc: L("[role=dialog] table tbody tr").nth(4).locator("td").nth(2), n: 3, at: "r" },
    { loc: L("[role=dialog] table tbody tr").last(), n: 4, at: "l" },
    { loc: L("[role=dialog] button", { hasText: "Fusionar clientes" }), n: 5, at: "t" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.keyboard.press("Escape");

await go(hProceso);
await page.getByRole("button", { name: "Cambiar cliente" }).click();
await page.waitForSelector("[role=dialog] select");
await page.selectOption("[role=dialog] select >> nth=0", { label: "Clínica Santa Aurora (CSA)" });
await page.selectOption("[role=dialog] select >> nth=1", { label: "+ Crear proyecto nuevo…" });
await page.waitForTimeout(300);
await shot("44-cambiar-cliente", {
  vp: true, clip: { x: 230, y: 10, width: 980, height: 880 },
  marks: [
    { loc: L("[role=dialog] select").nth(0), n: 1, at: "r" },
    { loc: L("[role=dialog] select").nth(1), n: 2, at: "r" },
    { loc: L("[role=dialog] div.rounded-2xl").first(), n: 3, at: "tl" },
    { loc: L("[role=dialog] button.btn"), n: 4, at: "t" },
  ],
});
await page.keyboard.press("Escape");

// ---------- 11. Tareas ----------
console.log("Tareas");
await go("/tareas");
await page.waitForSelector("section[aria-label='PENDIENTE'] article");
await shot("45-tareas-tablero", {
  clip: { x: 256, y: 0, width: 1184, height: 640 },
  marks: [
    { loc: L("main button.btn", { hasText: "Nueva tarea" }), n: 1, at: "t" },
    { loc: L("button", { hasText: "Limpiar terminadas" }), n: 2, at: "t" },
    { loc: L("[aria-label=Vista]"), n: 3, at: "t" },
    { loc: L("select[aria-label='Filtrar por persona']"), n: 4, at: "t" },
    { loc: L("section[aria-label='PENDIENTE'] > header"), n: 5, at: "tl" },
    { loc: L("article", { hasText: "Actualizar inventario" }), n: 6, at: "tr" },
    { loc: L("article", { hasText: "Levantar requerimientos" }), n: 7, at: "tr" },
    { loc: L("section[aria-label='PARA REVISAR'] > header"), n: 8, at: "tl" },
    { loc: L("a", { hasText: "Historial" }).last(), n: 9, at: "t" },
  ],
});

await L("button.btn", { hasText: "Nueva tarea" }).click();
await page.waitForSelector("[role=dialog] select");
await page.setViewportSize({ width: 1440, height: 1500 });
await page.selectOption("#t-client", { label: "Constructora Horizonte" });
await page.selectOption("#t-project", { label: "Torre Norte" });
await page.locator("[role=dialog] input[placeholder^='Escribe para buscar']").click();
await page.locator("[role=dialog] ul li button", { hasText: "Luis Gómez" }).click();
await page.fill("#t-title", "Revisar planos de la torre");
await page.locator("[role=dialog] .tiptap").click();
await page.keyboard.type("Revisar los planos actualizados y anotar las diferencias.");
await page.getByRole("button", { name: "Agregar recurso" }).click();
await page.fill("input[name=resourceTitle]", "Planos en Drive");
await page.fill("input[name=resourceUrl]", "https://drive.google.com/drive/folders/ejemplo-planos");
await page.locator("[role=dialog] h1, [role=dialog] h2").first().click();
await page.waitForTimeout(400);
const newBox = await L("[role=dialog] > div").boundingBox();
await shot("46-nueva-tarea", {
  vp: true, clip: { x: Math.max(0, newBox.x - 30), y: Math.max(0, newBox.y - 20), width: newBox.width + 60, height: newBox.height + 40 },
  marks: [
    { loc: L("#t-client"), n: 1, at: "t" },
    { loc: L("#t-project"), n: 2, at: "t" },
    { loc: L("[role=dialog] input[placeholder^='Escribe para buscar']"), n: 3, at: "r" },
    { loc: L("#t-title"), n: 4, at: "t" },
    { loc: L("#t-due"), n: 5, at: "t" },
    { loc: L("[role=dialog] .tiptap"), n: 6, at: "r" },
    { loc: L("[role=dialog] input[name=resourceTitle]"), n: 7, at: "t" },
    { loc: L("[role=dialog] button", { hasText: "Agregar recurso" }), n: 8, at: "b" },
    { loc: L("[role=dialog] button[type=submit]"), n: 9, at: "t" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.keyboard.press("Escape");

await go("/tareas");
await L("article", { hasText: "Entregar reporte de recorrido" }).click();
await page.waitForSelector("[role=dialog] aside");
await page.setViewportSize({ width: 1440, height: 1500 });
await page.waitForTimeout(800);
const detBox = await L("[role=dialog] > div").boundingBox();
await shot("47-detalle-tarea", {
  vp: true, clip: { x: Math.max(0, detBox.x - 30), y: Math.max(0, detBox.y - 20), width: detBox.width + 60, height: detBox.height + 40 },
  marks: [
    { loc: L("[role=dialog] h3", { hasText: "Comentarios" }), n: 1, at: "l" },
    { loc: L("[role=dialog] [aria-live=polite]"), n: 2, at: "bl" },
    { loc: L("[role=dialog] button", { hasText: "Emoji" }), n: 3, at: "b" },
    { loc: L("[role=dialog] button", { hasText: "Adjuntar" }), n: 4, at: "b" },
    { loc: L("[role=dialog] aside"), n: 5, at: "tr" },
    { loc: L("[role=dialog] select#mover-a"), n: 6, at: "l" },
    { loc: L("[role=dialog] aside button", { hasText: "Editar" }), n: 7, at: "b" },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.keyboard.press("Escape");

await go("/tareas");
await L("article", { hasText: "Entregar reporte de recorrido" }).dragTo(L("section[aria-label='TERMINADA']"));
await page.waitForSelector("text=Aceptar la tarea");
await page.fill("#accept-note", "¡Excelente trabajo, quedó muy clara la entrega!");
await shot("48-aceptar-tarea", {
  vp: true, clip: { x: 360, y: 200, width: 720, height: 460 },
  marks: [
    { loc: L("#accept-note"), n: 1, at: "r" },
    { loc: L("[role=dialog] input[type=checkbox]"), n: 2, at: "l" },
    { loc: L("[role=dialog] button", { hasText: "Aceptar tarea" }), n: 3, at: "t" },
  ],
});
await page.keyboard.press("Escape");

await go("/tareas");
await page.getByRole("button", { name: "Calendario" }).click();
await page.waitForTimeout(500);
await shot("49-calendario", {
  clip: { x: 256, y: 0, width: 1184, height: 900 },
  marks: [
    { loc: L("[aria-label=Vista] button[aria-pressed=true]"), n: 1, at: "t" },
    { loc: L("h2.capitalize"), n: 2, at: "t" },
    { loc: L("button[aria-label='Mes siguiente']"), n: 3, at: "t" },
    { loc: L("button[draggable=true]").first(), n: 4, at: "r" },
    { loc: L("button", { hasText: /^Hoy$/ }), n: 5, at: "t" },
  ],
});
await page.getByRole("button", { name: "Tablero" }).click();

await L("aside button[aria-label^='Avisos']").click();
await page.waitForSelector("[aria-label=Avisos] li button");
await shot("50-avisos", {
  vp: true, clip: { x: 0, y: 380, width: 640, height: 520 },
  marks: [
    { loc: L("aside button[aria-label^='Avisos']"), n: 1, at: "t", pad: 0 },
    { loc: L("[aria-label=Avisos] li button").first(), n: 2, at: "r" },
    { loc: L("[aria-label=Avisos] button", { hasText: "Marcar todo" }), n: 3, at: "t" },
  ],
});
await page.keyboard.press("Escape");

await browser.close();
console.log("Listo");
