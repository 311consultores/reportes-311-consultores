// Capturas para los manuales de los Evolutivos 14 a 17 (Documentos, proyectos desde el reporte, reordenar, Finanzas, cambio de perfil y Revisiones).
// Requiere: servidor local en :3000, datos de ejemplo y manual/seed-demo-e17.cjs. Uso: node manual/capture-e17.mjs [editor|admin|cliente|todo]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { launch, SHOTS, ROOT } from "./lib.mjs";

const BASE = "http://localhost:3000";
const require = createRequire(import.meta.url);
const SEED = path.join(ROOT, "seed-demo-e17.cjs");
const seed = (mode) => execFileSync("node", [SEED, mode], { stdio: "inherit" });
const only = process.argv[2] ?? "todo";
fs.mkdirSync(path.join(SHOTS, "admin"), { recursive: true });

const browser = await launch();
const HIDE = "nextjs-portal{display:none!important} *{caret-color:transparent!important}";

async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: "es-MX", colorScheme: "light", timezoneId: "America/Mexico_City" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(BASE + "/login");
  await page.fill("#email", email);
  await page.fill("#password", "TeamDemo2026");
  await page.click("form button.btn");
  await page.waitForURL(BASE + "/");
  await ctx.addCookies([{ name: "venc_cierre", value: new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date()), url: BASE }]);
  return { ctx, page };
}

const helpers = (page) => {
  const ready = async () => { await page.waitForLoadState("networkidle"); await page.addStyleTag({ content: HIDE }); await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((i) => { i.loading = "eager"; })); await page.waitForTimeout(1200); };
  const go = async (url) => { await page.goto(BASE + url); await ready(); };
  async function mark(items) {
    const boxes = [];
    for (const it of items) {
      const loc = typeof it.loc === "string" ? page.locator(it.loc).first() : it.loc.first();
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const bb = await loc.boundingBox({ timeout: 5000 }).catch(() => null);
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
  async function shot(file, { marks = [], clip, loc, pad = 16 } = {}) {
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(200);
    if (marks.length) await mark(marks);
    let clipBox = clip;
    if (loc) {
      const bb = await loc.first().boundingBox();
      const [sx, sy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
      clipBox = { x: Math.max(0, bb.x + sx - pad), y: Math.max(0, bb.y + sy - pad), width: bb.width + pad * 2, height: bb.height + pad * 2 };
    }
    await page.screenshot({ path: file + ".png", fullPage: true, ...(clipBox ? { clip: clipBox } : {}) });
    if (marks.length) await page.evaluate(() => document.getElementById("__marks")?.remove());
    console.log("  captura", path.basename(file));
  }
  return { go, shot, L: (s, o) => page.locator(s, o) };
};

/** Cada captura se intenta por separado: si una falla se avisa y se sigue con las demás. */
const attempt = async (name, fn) => { try { await fn(); } catch (e) { console.log("  ✖", name, "→", String(e.message).split("\n")[0]); } };

const pickClient = async (page, name) => {
  await page.getByPlaceholder(/Escribe para buscar un cliente/).click();
  await page.locator("li", { hasText: name }).first().click();
  await page.waitForTimeout(300);
};

// ============================ EDITOR ============================
if (only === "editor" || only === "todo") {
  seed("ajustes");
  const { ctx, page } = await session("editor@311consultores.com");
  const { go, shot, L } = helpers(page);
  const out = (n) => path.join(SHOTS, n);

  await attempt("nuevo reporte", async () => {
    console.log("Nuevo reporte con proyecto");
    await go("/reportes/nuevo");
    await pickClient(page, "Constructora Horizonte");
    await page.locator("select[name=projectId]").selectOption({ label: "Torre Norte" });
    await shot(out("e15-nuevo-reporte-proyecto"), {
      loc: L("main .card").first(),
      marks: [
        { loc: L("button", { hasText: "Crear proyecto" }), n: 1, at: "tl" },
        { loc: L("button[aria-label='Editar el proyecto elegido']"), n: 2, at: "tr" },
      ],
    });
    await L("button", { hasText: "Crear proyecto" }).click();
    await page.waitForSelector("#prj-name");
    await page.fill("#prj-name", "Torre Sur");
    await shot(out("e15b-crear-proyecto"), {
      loc: L("[role=dialog] .card"),
      marks: [
        { loc: L("#prj-name"), n: 1, at: "tl" },
        { loc: L("#prj-resp"), n: 2, at: "tl" },
        { loc: L("[role=dialog] .input.flex"), n: 3, at: "tl" },
        { loc: L("[role=dialog] button.btn", { hasText: "Crear proyecto" }), n: 4, at: "tl" },
      ],
    });
  });

  await attempt("reordenar", async () => {
    console.log("Reordenar actividades");
    await go("/reportes/3588d338-2f79-4c4b-a301-6864a56e7fa7");
    await L("button[aria-label='Abrir actividad']").first().click().catch(() => {});
    await page.waitForTimeout(300);
    await shot(out("e16-reordenar"), {
      loc: L("main section.space-y-4"),
      marks: [
        { loc: L("button[aria-label='Arrastrar para reordenar la actividad']").nth(1), n: 1, at: "tl" },
        { loc: L("button[aria-label='Subir la actividad']").nth(1), n: 2, at: "tr", pad: 2 },
        { loc: L("button[aria-label='Bajar la actividad']").nth(1), n: 3, at: "br", pad: 2 },
      ],
    });
  });

  await attempt("documentos", async () => {
    console.log("Documentos");
    await go("/documentos");
    await shot(out("e18-documentos"), {
      clip: { x: 256, y: 20, width: 1184, height: 770 },
      marks: [
        { loc: L("main a.btn", { hasText: "Recibo de pago" }), n: 1, at: "tl" },
        { loc: L("main a.btn", { hasText: "Acuerdo" }), n: 2, at: "t" },
        { loc: L("main a.btn", { hasText: "Contrato" }), n: 3, at: "tr" },
        { loc: L("main form.card"), n: 4, at: "tl" },
        { loc: L("main table"), n: 5, at: "tl" },
      ],
    });
    await go("/documentos/nuevo/contrato");
    await pickClient(page, "Constructora Horizonte");
    await page.fill("#f-ramo", "ferretero");
    await L("input[name=pMes]").first().fill("Noviembre 2026");
    await L("input[name=pMonto]").first().fill("22500.00");
    await shot(out("e19-contrato-form"), {
      clip: { x: 256, y: 20, width: 1184, height: 1550 },
      marks: [
        { loc: L("main [role=combobox]"), n: 1, at: "tl" },
        { loc: L("#f-ramo"), n: 2, at: "tl" },
        { loc: L("input[name=servicio]").first().locator("xpath=ancestor::label"), n: 3, at: "tl" },
        { loc: L("input[name=pMes]").first(), n: 4, at: "tl" },
        { loc: L("button", { hasText: "Agregar pago" }), n: 5, at: "tl" },
        { loc: L("#f-penalidadPct"), n: 6, at: "tl" },
      ],
    });
  });

  await attempt("revisiones equipo", async () => {
    console.log("Revisiones (equipo)");
    await go("/revisiones");
    await shot(out("e21-revisiones-lista"), {
      clip: { x: 256, y: 20, width: 1184, height: 570 },
      marks: [
        { loc: L("main a.btn", { hasText: "Nueva revisión" }), n: 1, at: "tl" },
        { loc: L("main div.flex.flex-wrap.gap-2").first(), n: 2, at: "tl" },
        { loc: L("main table"), n: 3, at: "tl" },
      ],
    });
    await go("/revisiones/nueva");
    await pickClient(page, "Constructora Horizonte").catch(async () => { await page.locator("li", { hasText: "Constructora Horizonte" }).first().click(); });
    await page.locator("#projectId").selectOption({ label: "Torre Norte" });
    await page.fill("#title", "Parrilla diciembre 2026");
    await page.locator("#copyUserId").selectOption({ index: 1 });
    await page.locator("#artUserId").selectOption({ index: 2 });
    await shot(out("e22-nueva-revision"), {
      loc: L("main .card").first(),
      marks: [
        { loc: L("#projectId"), n: 1, at: "tl" },
        { loc: L("#title"), n: 2, at: "tl" },
        { loc: L("#copyUserId"), n: 3, at: "tl" },
        { loc: L("#artUserId"), n: 4, at: "tr" },
        { loc: L("#respondBy"), n: 5, at: "tl" },
        { loc: L("main .card .input.flex"), n: 6, at: "tl" },
      ],
    });
    await go("/revisiones");
    await L("a", { hasText: "Campaña Buen Fin" }).first().click();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(600);
    await shot(out("e23-armar-revision"), {
      clip: { x: 256, y: 20, width: 1184, height: 1170 },
      marks: [
        { loc: L("button", { hasText: "Publicar al cliente" }), n: 1, at: "tl" },
        { loc: L("section.card").first(), n: 2, at: "tl" },
        { loc: L("button", { hasText: "Agregar slide" }), n: 3, at: "tl" },
        { loc: L("button[aria-label='Arrastrar para reordenar el slide']").first(), n: 4, at: "tl" },
        { loc: L("button[aria-label='Eliminar el slide']").first(), n: 5, at: "tl" },
      ],
    });
    await page.waitForTimeout(1500);
    await shot(out("e23b-slide-abierto"), {
      loc: L("main section.space-y-4 > div").last(),
      marks: [
        { loc: L("main section.space-y-4 textarea").last(), n: 1, at: "tl" },
        { loc: L("main section.space-y-4 select").last(), n: 2, at: "tl" },
        { loc: L("main section.space-y-4 label.cursor-pointer").last(), n: 3, at: "tl" },
        { loc: L("button", { hasText: "Simular vista en redes" }).last(), n: 4, at: "tl" },
      ],
    });
    await L("button", { hasText: "Simular vista en redes" }).last().click();
    await page.waitForSelector("[role=dialog]");
    await page.waitForTimeout(500);
    await shot(out("e24-simulador"), {
      loc: L("[role=dialog] .card"),
      marks: [
        { loc: L("[role=dialog] button", { hasText: "Facebook" }), n: 1, at: "tl" },
        { loc: L("[role=dialog] button", { hasText: "Instagram" }), n: 2, at: "t" },
        { loc: L("[role=dialog] button", { hasText: "Vertical 4:5" }), n: 3, at: "t" },
      ],
    });
  });

  await attempt("seguimiento", async () => {
    console.log("Seguimiento y tarea de ajustes");
    seed("ajustes");
    await go("/revisiones/e702b71d-d30b-4d3c-9848-11fc3d9eb407");
    await shot(out("e25-seguimiento"), {
      clip: { x: 256, y: 20, width: 1184, height: 1350 },
      marks: [
        { loc: L("main section.card").nth(0), n: 1, at: "tl" },
        { loc: L("main section.card").nth(1), n: 2, at: "tl" },
        { loc: L("article").first().locator("p.label").first(), n: 3, at: "tl" },
        { loc: L("article").first().locator("textarea"), n: 4, at: "tl" },
        { loc: L("article").first().locator("input[type=checkbox]").first(), n: 5, at: "tl" },
      ],
    });
    await go("/tareas?tarea=9b1d3d4d-37cd-4e80-96ac-eae4c52140d7");
    await page.waitForSelector("[role=dialog]");
    await page.waitForTimeout(500);
    await shot(out("e26-tarea-ajustes"), {
      loc: L("[role=dialog] .card").first(),
      marks: [
        { loc: L("[role=dialog] span", { hasText: "REDES Y ADS" }), n: 1, at: "tl" },
        { loc: L("[role=dialog] ul li").first(), n: 2, at: "tl" },
        { loc: L("[role=dialog] a", { hasText: "Abrir slide" }).first(), n: 3, at: "tr" },
      ],
    });
    const boxes = L("[role=dialog] input[type=checkbox]");
    const n = await boxes.count();
    for (let i = 0; i < n; i++) { await boxes.nth(i).check(); await page.waitForTimeout(1500); }
    const modal = page.locator("[role=dialog]").filter({ hasText: "Todos los ajustes están listos" }).last();
    await modal.waitFor();
    await page.waitForTimeout(500);
    await shot(out("e27-enviar-cliente"), {
      loc: modal.locator(".card").last(),
      marks: [
        { loc: modal.locator("button", { hasText: "Enviar por WhatsApp" }), n: 1, at: "tl" },
        { loc: modal.locator("button", { hasText: "Enviar al cliente" }), n: 2, at: "tl" },
      ],
    });
  });
  await ctx.close();
}

// ============================ CLIENTE ============================
if (only === "cliente" || only === "todo") {
  seed("cliente");
  const { ctx, page } = await session("cliente.demo@311consultores.com");
  const { go, shot, L } = helpers(page);
  const out = (n) => path.join(SHOTS, n);
  await attempt("cliente", async () => {
    console.log("Revisiones (cliente)");
    await go("/revisiones");
    await shot(out("e28-cliente-lista"), {
      clip: { x: 256, y: 20, width: 1184, height: 560 },
      marks: [
        { loc: L("aside a", { hasText: "Revisiones" }), n: 1, at: "tr" },
        { loc: L("main div.flex.flex-wrap.gap-2").first(), n: 2, at: "tl" },
        { loc: L("main article").first(), n: 3, at: "tl" },
        { loc: L("main article a").first(), n: 4, at: "tl" },
      ],
    });
    await go("/revisiones/e702b71d-d30b-4d3c-9848-11fc3d9eb407");
    await page.waitForSelector("button[aria-label='Ir al slide 1']");
    await L("button[aria-label='Ir al slide 2']").click();
    await page.waitForTimeout(500);
    await L("button", { hasText: "Comentar arte" }).click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(out("e29-cliente-visor"), {
      clip: { x: 256, y: 20, width: 1184, height: 840 },
      marks: [
        { loc: L("button[aria-label='Ir al slide 1']"), n: 1, at: "tl" },
        { loc: L("main section.card").first(), n: 2, at: "tl" },
        { loc: L("main section.card").nth(1), n: 3, at: "tl" },
        { loc: L("button", { hasText: "Aprobar slide" }), n: 4, at: "tl" },
        { loc: L("aside.card"), n: 5, at: "tl" },
        { loc: L("button", { hasText: "Enviar ajustes" }), n: 6, at: "tl" },
      ],
    });
    await L("button[aria-label='Ir al slide 3']").click();
    await page.waitForTimeout(500);
    await L("button", { hasText: "Aprobar slide" }).click();
    await page.waitForSelector("[role=dialog]");
    await shot(out("e30-cliente-aprobar"), { loc: L("[role=dialog] .card"), marks: [
      { loc: L("[role=dialog] button", { hasText: "Sí, aprobar" }), n: 1, at: "tl" },
    ] });
  });
  await ctx.close();
  seed("ajustes");
}

// ============================ ADMINISTRADOR ============================
if (only === "admin" || only === "todo") {
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  const { ctx, page } = await session("admin@311consultores.com");
  const { go, shot, L } = helpers(page);
  const out = (n) => path.join(SHOTS, "admin", n);

  await attempt("finanzas", async () => {
    console.log("Finanzas");
    const inv = await db.invoice.findFirst({ where: { number: "A-2026-014" } });
    const snap = JSON.parse(inv.distribution);
    snap.lines.push({ box: "DEV", cents: 450000 });
    await db.invoice.update({ where: { id: inv.id }, data: { isSoftware: true, distribution: JSON.stringify(snap) } });
    try {
      await go("/finanzas?mes=todos");
      await shot(out("a17-finanzas-cajas"), {
        clip: { x: 256, y: 20, width: 1184, height: 860 },
        marks: [
          { loc: L("main .grid").first(), n: 1, at: "tl" },
          { loc: L("main section", { has: page.getByRole("heading", { name: "Cajas de la empresa" }) }).first(), n: 2, at: "tl" },
          { loc: L("main a[href^='/finanzas/caja/']").first(), n: 3, at: "tr" },
        ],
      });
      const dev = L("main section.card", { has: page.getByRole("heading", { name: /Desarrollo \(DEV\)/ }) });
      await shot(out("a18-dev"), {
        loc: dev,
        marks: [
          { loc: dev.locator("p.text-2xl"), n: 1, at: "tl" },
          { loc: dev.locator("table"), n: 2, at: "tl" },
        ],
      });
      await go("/finanzas/caja/NOMINA?mes=todos");
      await shot(out("a19-historial-caja"), {
        clip: { x: 256, y: 20, width: 1184, height: 680 },
        marks: [
          { loc: L("main .grid").first(), n: 1, at: "tl" },
          { loc: L("main form.card"), n: 2, at: "tl" },
          { loc: L("main table"), n: 3, at: "tl" },
        ],
      });
    } finally {
      const snap2 = JSON.parse((await db.invoice.findUnique({ where: { id: inv.id } })).distribution);
      snap2.lines = snap2.lines.filter((l) => l.box !== "DEV");
      await db.invoice.update({ where: { id: inv.id }, data: { isSoftware: false, distribution: JSON.stringify(snap2) } });
    }
    await go("/finanzas/configuracion");
    await shot(out("a20-porcentajes"), {
      loc: L("main section.card").first(),
      marks: [
        { loc: L("#nomina"), n: 1, at: "tl" },
        { loc: L("#dev"), n: 2, at: "tl" },
        { loc: L("#utilidad-general"), n: 3, at: "tr" },
        { loc: L("#socio"), n: 4, at: "tl" },
      ],
    });
  });

  await attempt("cambio de perfil", async () => {
    console.log("Cambio de perfil");
    const ed = await db.user.findUnique({ where: { email: "editor@311consultores.com" } });
    const ad = await db.user.findUnique({ where: { email: "admin@311consultores.com" } });
    await db.user.updateMany({ where: { id: { in: [ed.id, ad.id] } }, data: { linkedUserId: null } });
    await go("/perfil");
    await shot(out("a21-cambio-perfil"), {
      loc: L("main section.card").filter({ hasText: "Cambio de perfil" }),
      marks: [
        { loc: L("#link-email"), n: 1, at: "tl" },
        { loc: L("#link-pass"), n: 2, at: "tl" },
        { loc: L("main button.btn", { hasText: "Vincular cuenta" }), n: 3, at: "tl" },
      ],
    });
    await db.user.update({ where: { id: ad.id }, data: { linkedUserId: ed.id } });
    await db.user.update({ where: { id: ed.id }, data: { linkedUserId: ad.id } });
    try {
      await go("/");
      const btn = L("button", { hasText: "Cambiar a" });
      const bb = await btn.boundingBox();
      await shot(out("a22-boton-cambiar"), { clip: { x: 0, y: Math.max(0, bb.y - 90), width: 290, height: 230 }, marks: [{ loc: btn, n: 1, at: "r" }] });
    } finally {
      await db.user.updateMany({ where: { id: { in: [ed.id, ad.id] } }, data: { linkedUserId: null } });
    }
  });

  await attempt("configuración de documentos", async () => {
    console.log("Documentos › Configuración");
    await go("/documentos/configuracion");
    await shot(out("a23-doc-config"), {
      clip: { x: 256, y: 20, width: 1184, height: 1290 },
      marks: [
        { loc: L("#c-razonSocial"), n: 1, at: "tl" },
        { loc: L("textarea[name=cargos]"), n: 2, at: "tl" },
        { loc: L("input[name=pNombre]").first(), n: 3, at: "tl" },
        { loc: L("#c-contactEmail"), n: 4, at: "tl" },
        { loc: L("button.btn", { hasText: "Guardar configuración" }), n: 5, at: "tl" },
      ],
    });
  });
  await ctx.close();
  await db.$disconnect();
}

await browser.close();
console.log("Listo");
