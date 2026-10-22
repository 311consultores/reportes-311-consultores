// Solo para el manual: agrega tareas entregadas de ejemplo (últimas semanas) en la base LOCAL
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("node:crypto");
const H = 3600_000;
(async () => {
  const p = new PrismaClient();
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "")) throw new Error("Solo base local");
  await p.setting;
  const editor = await p.user.findFirst({ where: { role: "EDITOR" } });
  const team = Object.fromEntries((await p.user.findMany({ where: { name: { in: ["Ana Pérez", "Luis Gómez", "Sofía Ríos"] } } })).map((u) => [u.name.split(" ")[0], u]));
  const areas = Object.fromEntries((await p.area.findMany()).map((a) => [a.name, a]));
  const projects = await p.project.findMany({ take: 3, include: { client: true } });
  await p.appSetting.upsert({ where: { key: "metrics_green" }, create: { key: "metrics_green", value: "90" }, update: { value: "90" } });
  await p.appSetting.upsert({ where: { key: "metrics_amber" }, create: { key: "metrics_amber", value: "75" }, update: { value: "75" } });
  await p.task.deleteMany({ where: { title: { startsWith: "[demo] " } } });
  const now = Date.now();
  // [semanas atrás, quién, área, horas de plazo, horas de retraso (negativo = antes), devoluciones]
  const plan = [
    [4, "Ana", "DISEÑO", 48, -3, 0], [4, "Luis", "DESARROLLO", 72, 4, 1], [4, "Sofía", "CRM", 24, -1, 0],
    [3, "Ana", "DISEÑO", 48, -6, 0], [3, "Luis", "WEB", 96, -10, 0], [3, "Sofía", "CRM", 24, 9, 1], [3, "Ana", "REDES Y ADS", 48, 0, 0],
    [2, "Ana", "DISEÑO", 72, -2, 0], [2, "Luis", "DESARROLLO", 48, 12, 1], [2, "Sofía", "CONSULTORÍA", 48, -5, 0], [2, "Luis", "WEB", 72, -1, 0],
    [1, "Ana", "REDES Y ADS", 48, -4, 0], [1, "Luis", "DESARROLLO", 48, 2, 0], [1, "Sofía", "CRM", 24, -2, 0], [1, "Sofía", "CONSULTORÍA", 48, 20, 1], [1, "Ana", "DISEÑO", 24, -1, 0],
  ];
  let n = 0;
  for (const [wk, who, area, span, late, ret] of plan) {
    n++;
    const created = new Date(now - wk * 7 * 24 * H + (n % 5) * 3 * H - 2 * 24 * H);
    const due = new Date(created.getTime() + span * H);
    const ready = new Date(due.getTime() + late * H);
    const accepted = new Date(ready.getTime() + (3 + (n % 4)) * H);
    const pr = projects[n % projects.length];
    const id = randomUUID();
    const ev = [
      { kind: "CREATED", userId: editor.id, createdAt: created },
      { kind: "MOVED", userId: team[who].id, note: "PENDIENTE → EN_PROCESO", createdAt: new Date(created.getTime() + (2 + (n % 6)) * H) },
      { kind: "READY", userId: team[who].id, createdAt: ready },
    ];
    if (ret) ev.push({ kind: "RETURNED", userId: editor.id, note: "Falta ajustar detalles", createdAt: new Date(ready.getTime() + 2 * H) }, { kind: "READY", userId: team[who].id, createdAt: new Date(ready.getTime() + 6 * H) });
    ev.push({ kind: "ACCEPTED", userId: editor.id, createdAt: new Date(accepted.getTime() + (ret ? 6 * H : 0)) });
    await p.task.create({
      data: {
        id, title: `[demo] ${area} · entrega ${n}`, descriptionHtml: "<p>Tarea de ejemplo</p>", dueAt: due, status: "TERMINADA", createdById: editor.id, createdAt: created,
        readyAt: ready, acceptedAt: accepted, hiddenAt: new Date(), clientId: pr.clientId, projectId: pr.id, areaId: areas[area].id,
        assignees: { create: [{ userId: team[who].id }] },
        events: { create: ev },
      },
    });
  }
  console.log("tareas demo:", n);
  await p.$disconnect();
})();
