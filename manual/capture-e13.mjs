// Capturas nuevas del Evolutivo 13 (préstamos de las cajas y usuarios CLIENTE creados por el Editor).
// Requiere: servidor local en :3000 y datos de ejemplo. No borra las demás capturas.
//   admin/a13-prestamos, admin/a14-nuevo-prestamo, admin/a15-resumen-deuda, admin/a16-aviso-abono (manual del ADMINISTRADOR)
//   e13-nuevo-cliente, e14-editar-cliente (manual del Editor)
import fs from "node:fs";
import path from "node:path";
import { launch, SHOTS } from "./lib.mjs";

const BASE = "http://localhost:3000";
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
  const ready = async () => { await page.waitForLoadState("networkidle"); await page.addStyleTag({ content: HIDE }); await page.waitForTimeout(250); };
  const go = async (url) => { await page.goto(BASE + url); await ready(); };
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
  async function shot(file, { marks = [], clip, loc, pad = 16 } = {}) {
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(150);
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

// ---------- ADMINISTRADOR ----------
{
  const { ctx, page } = await session("admin@311consultores.com");
  const { go, shot, L } = helpers(page);
  const out = (n) => path.join(SHOTS, "admin", n);

  console.log("Préstamos");
  await go("/finanzas/prestamos");
  await L("main details").filter({ has: page.locator("input[name=loanId]") }).evaluate((d) => (d.open = true));
  await page.waitForTimeout(300);
  const card = L("main section", { hasText: "Préstamo de la caja Navidad" }).first();
  await shot(out("a13-prestamos"), {
    clip: { x: 256, y: 90, width: 1184, height: 1000 },
    marks: [
      { loc: L("main div.grid > div").first(), n: 1, at: "tl" },
      { loc: L("main summary", { hasText: "Registrar préstamo" }), n: 2, at: "r" },
      { loc: card.locator("[role=progressbar]"), n: 3, at: "tl" },
      { loc: card.locator("table"), n: 4, at: "tl" },
      { loc: card.locator("summary", { hasText: "Registrar abono" }), n: 5, at: "tl" },
      { loc: card.locator("button", { hasText: "Anular" }).first(), n: 6, at: "tl" },
    ],
  });

  console.log("Nuevo préstamo");
  await go("/finanzas/prestamos?inicial=1");
  const form = L("main form").filter({ has: page.locator("input[name=recipient]") });
  await shot(out("a14-nuevo-prestamo"), {
    loc: L("main details").first(),
    marks: [
      { loc: form.locator("input[name=concept]"), n: 1, at: "tl" },
      { loc: form.locator("input[name=recipient]"), n: 2, at: "tl" },
      { loc: form.locator("input[name=loanDate]"), n: 3, at: "tr" },
      { loc: form.locator("select[name=originBox]"), n: 4, at: "tl" },
      { loc: form.locator("select[name=originType]"), n: 5, at: "tl" },
      { loc: form.locator("input[name=originAmount]"), n: 6, at: "tr" },
      { loc: form.locator("button", { hasText: "Agregar otra caja" }), n: 7, at: "tl" },
      { loc: form.locator("input[name=alreadyDeducted]"), n: 8, at: "tl" },
      { loc: form.locator("button[type=submit]"), n: 9, at: "tl" },
    ],
  });

  console.log("Resumen");
  await go("/finanzas?mes=todos");
  await shot(out("a15-resumen-deuda"), {
    loc: L("main section", { has: page.getByRole("heading", { name: "Préstamos de las cajas" }) }),
    marks: [
      { loc: L("main section", { has: page.getByRole("heading", { name: "Préstamos de las cajas" }) }).locator("[role=progressbar]"), n: 1, at: "tl" },
      { loc: L("main section", { has: page.getByRole("heading", { name: "Préstamos de las cajas" }) }).locator("a.btn-outline"), n: 2, at: "tr" },
    ],
  });

  console.log("Aviso de abono");
  await go("/finanzas");
  await page.evaluate(() => {
    const n = { total: "$13,849.50", items: [{ id: "x", concept: "Préstamo de la caja Navidad", pending: "$13,849.50", boxes: "Navidad $13,849.50" }] };
    sessionStorage.setItem("loan_prompt", JSON.stringify(n));
    window.dispatchEvent(new Event("loan-prompt"));
  });
  await page.waitForSelector("[role=dialog]");
  await page.evaluate(() => sessionStorage.removeItem("loan_prompt"));
  const dlg = L("[role=dialog] .card");
  await shot(out("a16-aviso-abono"), {
    clip: await dlg.boundingBox().then((b) => ({ x: b.x - 24, y: b.y - 24, width: b.width + 48, height: b.height + 48 })),
    marks: [
      { loc: dlg.locator("p.meta"), n: 1, at: "tl" },
      { loc: dlg.locator("button", { hasText: "Ahora no" }), n: 2, at: "tl" },
      { loc: dlg.locator("a.btn"), n: 3, at: "tr" },
    ],
  });
  await ctx.close();
}

// ---------- EDITOR ----------
{
  const { ctx, page } = await session("editor@311consultores.com");
  const { go, shot, L } = helpers(page);

  console.log("Usuario CLIENTE (Editor)");
  await go("/usuarios");
  await L("main details").first().evaluate((d) => (d.open = true));
  const form = L("main form").filter({ has: page.locator("select[name=role]") }).first();
  await form.locator("select[name=role]").selectOption("CLIENTE");
  await page.waitForTimeout(300);
  await form.locator("select[name=clientId]").selectOption({ index: 1 });
  await form.locator("input[name=name]").fill("Laura Mendoza");
  await form.locator("input[name=email]").fill("laura.mendoza@ejemplo.test");
  await form.locator("input[name=password]").fill("ClaveInicial2026");
  await shot(path.join(SHOTS, "e13-nuevo-cliente"), {
    loc: L("main details").first(),
    marks: [
      { loc: form.locator("input[name=name]"), n: 1, at: "tl" },
      { loc: form.locator("input[name=email]"), n: 2, at: "tl" },
      { loc: form.locator("input[name=password]"), n: 3, at: "tl" },
      { loc: form.locator("select[name=role]"), n: 4, at: "tl" },
      { loc: form.locator("select[name=clientId]"), n: 5, at: "tl" },
      { loc: form.locator("button[type=submit]"), n: 6, at: "tl" },
    ],
  });
  await form.locator("button[type=submit]").click();
  await page.waitForSelector("text=Usuario creado");

  console.log("Editar CLIENTE (Editor)");
  await go("/usuarios");
  await page.getByRole("tab", { name: /CLIENTES/ }).click();
  await page.waitForTimeout(300);
  const row = L("tbody tr", { hasText: "Laura Mendoza" });
  await row.getByRole("button", { name: "Editar" }).click();
  const dialog = L("[role=dialog]").last();
  await dialog.waitFor();
  await page.waitForTimeout(300);
  await shot(path.join(SHOTS, "e14-editar-cliente"), {
    loc: dialog.locator(".card, div").first(),
    pad: 10,
    marks: [
      { loc: dialog.locator("input[name=password]"), n: 1, at: "tl" },
      { loc: dialog.locator("select[name=clientId]"), n: 2, at: "tl" },
      { loc: dialog.locator("button[type=submit]"), n: 3, at: "tl" },
    ],
  });
  await ctx.close();
}

await browser.close();
console.log("Listo");
