// Toma las capturas del manual con marcas numeradas. Requiere: servidor local en :3000 y datos de ejemplo (seed-demo.ts)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, ROOT, SHOTS } from "./lib.mjs";

const BASE = "http://localhost:3000";
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, "..", ".env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);

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
    // coordenadas de documento (no cambian aunque la pagina se desplace despues)
    boxes.push({ n: it.n, at: it.at, pad: it.pad, bb: { x: bb.x + sx, y: bb.y + sy, width: bb.width, height: bb.height } });
  }
  await page.evaluate((boxes) => {
    const sx = 0, sy = 0;
    const wrap = document.createElement("div");
    wrap.id = "__marks";
    wrap.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none";
    for (const b of boxes) {
      const pad = b.pad ?? 4;
      const x = b.bb.x + sx - pad, y = b.bb.y + sy - pad, w = b.bb.width + pad * 2, h = b.bb.height + pad * 2;
      const box = document.createElement("div");
      box.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:3px solid #E5252A;border-radius:10px;box-sizing:border-box;background:rgba(229,37,42,.06)`;
      const dot = document.createElement("div");
      dot.textContent = b.n;
      const S = 26;
      const at = b.at ?? "tl";
      const pos = {
        tl: [x - S / 2, y - S / 2], tr: [x + w - S / 2, y - S / 2], bl: [x - S / 2, y + h - S / 2], br: [x + w - S / 2, y + h - S / 2],
        l: [x - S - 4, y + h / 2 - S / 2], r: [x + w + 4, y + h / 2 - S / 2], t: [x + w / 2 - S / 2, y - S - 4], b: [x + w / 2 - S / 2, y + h + 4],
      }[at];
      dot.style.cssText = `position:absolute;left:${pos[0]}px;top:${pos[1]}px;width:${S}px;height:${S}px;border-radius:50%;background:#E5252A;color:#fff;font:700 15px Arial,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
      wrap.append(box, dot);
    }
    document.body.append(wrap);
  }, boxes);
}
const unmark = () => page.evaluate(() => document.getElementById("__marks")?.remove());

/**
 * Toma una captura. opts.marks: marcas; opts.full: pagina completa; opts.clip: Locator | {x,y,width,height} (coordenadas de documento)
 */
async function shot(name, opts = {}) {
  const { marks = [], full = false, clip, pad = 16, vp = false } = opts; // vp: el recorte es de la ventana visible (ventanas emergentes fijas)
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

// ---------- 1. Acceso ----------
console.log("Acceso");
await go("/login");
await shot("01-login", {
  clip: { x: 340, y: 150, width: 760, height: 600 },
  marks: [
    { loc: "#email", n: 1 },
    { loc: "#password", n: 2 },
    { loc: "button[aria-label*='ontrase'], #password + button, #password ~ button", n: 3, at: "tr", pad: 2 },
    { loc: L("form button.btn"), n: 4 },
    { loc: T("¿Olvidaste tu contraseña?"), n: 5 },
  ],
});
await go("/recuperar");
await shot("02-recuperar", { clip: { x: 340, y: 180, width: 760, height: 560 }, marks: [{ loc: L("input[type=email], input[name=email]"), n: 1 }, { loc: L("form button.btn"), n: 2 }] });

await login("editor@311consultores.com", env.SEED_EDITOR_PASSWORD);

// ---------- 2. Menu y lista ----------
console.log("Menu y lista");
await page.setViewportSize({ width: 1440, height: 600 });
await page.waitForTimeout(300);
await shot("03-menu", {
  clip: { x: 0, y: 0, width: 300, height: 600 },
  marks: [
    { loc: L("aside nav a", { hasText: "Reportes" }), n: 1, at: "r" },
    { loc: L("aside nav a", { hasText: "Clientes y proyectos" }), n: 2, at: "r" },
    { loc: L("aside nav a", { hasText: "Registro de clientes" }), n: 3, at: "r" },
    { loc: L("aside form button"), n: 4, at: "bl" },
    { loc: L("aside button[aria-label*='modo']"), n: 5, at: "t", pad: 0 },
  ],
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);
await shot("04-lista", {
  clip: { x: 0, y: 0, width: 1440, height: 520 },
  marks: [
    { loc: L("input[placeholder^='Buscar']"), n: 1 },
    { loc: L("a.btn", { hasText: "Nuevo reporte" }), n: 2 },
    { loc: L("a", { hasText: /^Todos$/ }), n: 3, at: "tl" },
    { loc: L("th a", { hasText: "Folio" }), n: 4, at: "t" },
    { loc: L("td a", { hasText: "HRZ003091026" }), n: 5 },
    { loc: L("tbody tr", { hasText: "HRZ003091026" }).locator("td").last(), n: 6, at: "r" },
  ],
});
await page.fill("input[placeholder^='Buscar']", "Aurora");
await page.waitForSelector("text=CSA00");
await page.waitForTimeout(400);
await shot("05-busqueda", { clip: { x: 0, y: 0, width: 1440, height: 520 }, marks: [{ loc: L("input[placeholder^='Buscar']"), n: 1 }, { loc: L("div.glass button").first(), n: 2, at: "r" }] });
await page.keyboard.press("Escape");

await go("/?status=RECHAZADO");
await shot("06-filtro", { clip: { x: 0, y: 0, width: 1440, height: 330 }, marks: [{ loc: L("a", { hasText: /^Rechazado$/ }), n: 1, at: "t" }] });
await go("/?sort=folio&dir=asc");
await shot("07-ordenar", { clip: { x: 0, y: 0, width: 1440, height: 520 }, marks: [{ loc: L("th a", { hasText: "Folio" }), n: 1, at: "t" }] });

// ---------- 3. Nuevo reporte ----------
console.log("Nuevo reporte");
await go("/reportes/nuevo");
await page.fill("input[role=combobox]", "Hori");
await page.locator("ul[role=listbox] li", { hasText: "Constructora Horizonte" }).click();
await page.selectOption("select[name=projectId]", { label: "Torre Norte" });
await page.fill("input[name=startDate]", "2026-10-12");
await page.fill("input[name=consultants]", "Ana Pérez, Luis Gómez");
await page.waitForTimeout(300);
await shot("08-nuevo-reporte", {
  clip: { x: 256, y: 0, width: 1184, height: 600 },
  marks: [
    { loc: L("input[role=combobox]"), n: 1 },
    { loc: L("select[name=projectId]"), n: 2 },
    { loc: L("input[name=startDate]"), n: 3 },
    { loc: L("input[name=endDate]"), n: 4 },
    { loc: L("input[name=consultants]"), n: 5 },
    { loc: L("form button.btn"), n: 6 },
  ],
});

// ---------- 4. Reporte ----------
console.log("Reporte");
const reportHref = async (folio) => {
  await go("/");
  return page.locator("td a", { hasText: folio }).getAttribute("href");
};
const hProceso = await reportHref("HRZ003091026");
const hTerminado = await reportHref("CSA002091026");
const hRechazado = await reportHref("CSA001071026");
const hAprobado = await reportHref("HRZ002290926");
const hEnviado = await reportHref("HRZ001220926");

await go(hProceso);
await shot("09-reporte", {
  clip: { x: 256, y: 0, width: 1184, height: 560 },
  marks: [
    { loc: L("a", { hasText: "Reportes" }).filter({ has: page.locator("svg") }).last(), n: 1, at: "r" },
    { loc: L("h1.page-title"), n: 2 },
    { loc: L("span.badge, [class*='rounded-full']", { hasText: "En proceso" }), n: 3, at: "l" },
    { loc: L("dl"), n: 4, at: "b" },
    { loc: L("button.btn", { hasText: "Marcar como terminado" }), n: 5 },
    { loc: L("a", { hasText: "Ver PDF" }), n: 6, at: "b" },
    { loc: L("button", { hasText: "Solicitar eliminación del reporte" }), n: 7, at: "r" },
  ],
});

// Actividades: la tercera esta vacia; se escribe en ella para mostrar el guardado automatico
await page.fill("input[id^='title-']:visible", "Seguimiento semanal");
await page.locator(".ProseMirror:visible").click();
await page.keyboard.type("Se revisó el avance de la semana con el equipo del cliente.");
await page.waitForTimeout(400);
await shot("10-actividad-escribiendo", {
  clip: L("section").first(),
  pad: 10,
  marks: [
    { loc: L("button.btn", { hasText: "Agregar actividad" }), n: 1, at: "tl" },
    { loc: L("section .card").nth(2).locator("button[aria-expanded]"), n: 2, at: "l" },
    { loc: L("input[id^='title-']:visible"), n: 3 },
    { loc: L("section .card").nth(2).locator("div.border-y"), n: 4, at: "tl" },
    { loc: L(".ProseMirror:visible"), n: 5 },
    { loc: L("section .card").nth(2).getByText(/Guardando|Guardado/), n: 6, at: "b" },
  ],
});
await page.waitForTimeout(2600);
await shot("11-guardado", { clip: L("section .card").nth(2).locator("div").first(), pad: 22, marks: [{ loc: L("section .card").nth(2).getByText("Guardado"), n: 1, at: "b" }] });

// Evidencias: abrir la actividad 1 (tiene 2 fotos)
await page.locator("section .card").nth(0).locator("button[aria-expanded]").click();
await page.waitForTimeout(500);
await shot("12-evidencias", {
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

// Subir una evidencia de verdad (muestra la compresion) y capturar
const fileChooser = page.waitForEvent("filechooser");
await page.locator("section .card").nth(0).getByRole("button", { name: /Adjuntar evidencia/ }).click();
(await fileChooser).setFiles(path.join(ROOT, "assets", "foto-3.jpg"));
try {
  await page.locator("section .card").nth(0).getByText("3 de 3").waitFor({ timeout: 20000 });
} catch (e) {
  console.log("TEXTO TARJETA:", (await page.locator("section .card").nth(0).innerText()).slice(-300));
  throw e;
}
await page.waitForTimeout(500);
await shot("13-evidencia-subida", { clip: L("section .card").nth(0), pad: 8, marks: [{ loc: L("section .card").nth(0).getByText("3 de 3"), n: 1, at: "r" }, { loc: L("section .card").nth(0).locator("button[disabled]").first(), n: 2, at: "t" }] });

// Historial
await page.locator("details summary", { hasText: "Historial de cambios" }).click();
await page.waitForTimeout(300);
await shot("14-historial", { clip: L("details", { hasText: "Historial de cambios" }), pad: 10, marks: [{ loc: L("summary", { hasText: "Historial de cambios" }), n: 1, at: "l" }] });

// Solicitar eliminacion de actividad
await L("section .card").nth(1).getByRole("button", { name: /Solicitar eliminación/ }).click();
await page.waitForSelector("[role=dialog] textarea");
await page.fill("[role=dialog] textarea", "La actividad se capturó por error y ya existe en otro reporte.");
await shot("15-solicitar-eliminacion", {
  vp: true, clip: { x: 260, y: 230, width: 920, height: 480 },
  marks: [{ loc: L("[role=dialog] textarea"), n: 1 }, { loc: L("[role=dialog] button", { hasText: "Enviar solicitud" }), n: 2 }, { loc: L("[role=dialog] button", { hasText: "Cancelar" }), n: 3 }],
});
await page.locator("[role=dialog] button", { hasText: "Cancelar" }).click();

// Terminado
await go(hTerminado);
await shot("16-terminado", {
  clip: { x: 256, y: 0, width: 1184, height: 700 },
  marks: [
    { loc: L("[class*='rounded-full']", { hasText: "Terminado" }), n: 1, at: "l" },
    { loc: L("button", { hasText: "Solicitar eliminación del reporte" }), n: 2, at: "b" },
  ],
});
// Rechazado
await go(hRechazado);
await shot("17-rechazado", {
  clip: { x: 256, y: 0, width: 1184, height: 640 },
  marks: [
    { loc: L("[class*='rounded-full']", { hasText: "Rechazado" }), n: 1, at: "l" },
    { loc: L("p", { hasText: "Motivo del rechazo" }), n: 2, at: "b" },
    { loc: L("button.btn", { hasText: "Marcar como terminado" }), n: 3, at: "b" },
  ],
});
// Aprobado
await go(hAprobado);
await shot("18-aprobado", {
  clip: { x: 256, y: 0, width: 1184, height: 560 },
  marks: [
    { loc: L("[class*='rounded-full']", { hasText: "Aprobado" }), n: 1, at: "l" },
    { loc: L("button.btn", { hasText: "Enviar por correo" }), n: 2, at: "b" },
    { loc: L("a", { hasText: "Ver PDF" }), n: 3, at: "b" },
  ],
});
await page.getByRole("button", { name: /Enviar por correo/ }).click();
await page.waitForSelector("[role=dialog]");
await shot("19-confirmar-envio", { vp: true, clip: { x: 260, y: 270, width: 920, height: 400 }, marks: [{ loc: L("[role=dialog] button", { hasText: /^Enviar$/ }), n: 1 }, { loc: L("[role=dialog] button", { hasText: "Cancelar" }), n: 2 }] });
await page.locator("[role=dialog] button", { hasText: "Cancelar" }).click();
// Enviado
await go(hEnviado);
await shot("20-enviado", { clip: { x: 256, y: 0, width: 1184, height: 520 }, marks: [{ loc: L("[class*='rounded-full']", { hasText: "Enviado" }), n: 1, at: "l" }] });

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
  await p2.locator("#c").screenshot({ path: path.join(SHOTS, "21-pdf.png") });
  await p2.close();
  console.log("  captura 21-pdf");
}

// ---------- 5. Clientes y proyectos ----------
console.log("Clientes");
await go("/clientes");
await shot("22-nuevo-cliente", {
  clip: L("section.card").first(),
  pad: 14,
  marks: [
    { loc: L("input[name=companyName]"), n: 1 },
    { loc: L("input[name=folioPrefix]"), n: 2 },
    { loc: L("input[name=mainEmails]"), n: 3 },
    { loc: L("section.card").first().locator("input[type=file]"), n: 4 },
    { loc: L("section.card").first().locator("button.btn"), n: 5 },
  ],
});
const clientCard = (name) => L("section.card").filter({ has: page.locator("h2", { hasText: name }) });
const horizonte = clientCard("Constructora Horizonte");
await shot("23-cliente-proyectos", {
  clip: horizonte,
  pad: 12,
  marks: [
    { loc: horizonte.locator("img").first(), n: 1, at: "l" },
    { loc: horizonte.locator("ul.divide-y").first(), n: 2, at: "l" },
    { loc: horizonte.locator("input[name=projectName]"), n: 3 },
    { loc: horizonte.locator("input[name=projectEmails]"), n: 4 },
    { loc: horizonte.getByRole("button", { name: "Agregar proyecto" }), n: 5 },
    { loc: horizonte.locator("summary", { hasText: "Datos fiscales" }), n: 6 },
    { loc: horizonte.locator("summary", { hasText: "Cambiar logo" }), n: 7 },
  ],
});
await horizonte.locator("summary", { hasText: "Datos fiscales" }).click();
await page.waitForTimeout(300);
await shot("24-datos-fiscales", {
  clip: horizonte.locator("details").first(),
  pad: 10,
  marks: [
    { loc: horizonte.locator("details dl").first(), n: 1, at: "l" },
    { loc: horizonte.locator("a", { hasText: "Ver PDF" }), n: 2, at: "r" },
    { loc: horizonte.locator("details button").first(), n: 3, at: "r" },
    { loc: horizonte.locator("summary", { hasText: "Editar datos" }), n: 4, at: "l" },
  ],
});
await horizonte.locator("summary", { hasText: "Editar datos" }).click();
await page.waitForTimeout(300);
await shot("25-editar-datos", {
  clip: horizonte.locator("details details").first(),
  pad: 10,
  marks: [
    { loc: horizonte.locator("input[name=requiresInvoice]"), n: 1, at: "l" },
    { loc: horizonte.locator("input[name=rfc]"), n: 2 },
    { loc: horizonte.locator("input[name=constancia]"), n: 3 },
    { loc: horizonte.locator("input[name=contactName]"), n: 4 },
    { loc: horizonte.locator("input[name=billingName]"), n: 5 },
    { loc: horizonte.getByRole("button", { name: "Guardar datos" }), n: 6 },
  ],
});
await go("/clientes");
const aurora = clientCard("Clínica Santa Aurora");
await aurora.locator("summary", { hasText: "Cambiar logo" }).click();
await page.waitForTimeout(300);
await shot("26-cambiar-logo", {
  clip: aurora.locator("details").last(),
  pad: 26,
  marks: [
    { loc: aurora.locator("summary", { hasText: "Cambiar logo" }), n: 1, at: "l" },
    { loc: aurora.locator("input[type=file]"), n: 2 },
    { loc: aurora.getByRole("button", { name: "Guardar logo" }), n: 3 },
  ],
});

// ---------- 6. Registro de clientes ----------
console.log("Registros");
await go("/registros");
await shot("27-registros", {
  clip: { x: 0, y: 0, width: 1440, height: 760 },
  marks: [
    { loc: L("text=Enlace de registro para clientes"), n: 1, at: "l" },
    { loc: L("button", { hasText: "Copiar enlace" }), n: 2, at: "t" },
    { loc: L("a", { hasText: "Abrir" }), n: 3, at: "t" },
    { loc: L("aside nav a", { hasText: "Registro de clientes" }), n: 4, at: "r" },
    { loc: L("a, button", { hasText: "Revisar" }).first(), n: 5, at: "l" },
  ],
});
await go("/registro");
await shot("28-registro-publico", {
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
await shot("29-revision-1", {
  clip: { x: 256, y: 0, width: 1184, height: 900 },
  marks: [
    { loc: L("img[alt='Logo enviado']"), n: 1, at: "l" },
    { loc: L("input[name=companyName]"), n: 2 },
    { loc: L("a", { hasText: /constancia|Ver PDF/i }).first(), n: 3, at: "r" },
  ],
});
await page.mouse.wheel(0, 2400);
await page.waitForTimeout(300);
const prefixBox = await L("input[name=folioPrefix]").locator("xpath=ancestor::fieldset").boundingBox();
const rejectBox = await L("button", { hasText: "Rechazar registro" }).boundingBox();
const [scx, scy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
await shot("30-revision-2", {
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
await shot("31-rechazar-registro", { vp: true, clip: { x: 260, y: 230, width: 920, height: 480 }, marks: [{ loc: L("[role=dialog] textarea"), n: 1 }, { loc: L("[role=dialog] button", { hasText: /^Rechazar$/ }), n: 2 }, { loc: L("[role=dialog] button", { hasText: "Cancelar" }), n: 3 }] });
await page.locator("[role=dialog] button", { hasText: "Cancelar" }).click();

// ---------- 7. Modo oscuro (solo ubicacion del boton; se deja en claro) ----------
await browser.close();
console.log("Listo");
