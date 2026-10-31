// Prepara, en la base LOCAL de ejemplo, los estados de «Revisiones» que se fotografían para los manuales.
//   node manual/seed-demo-e17.cjs borrador   → crea (si falta) la revisión en borrador «Campaña Buen Fin»
//   node manual/seed-demo-e17.cjs cliente    → «Parrilla noviembre 2026» publicada, con comentarios en borrador del cliente
//   node manual/seed-demo-e17.cjs ajustes    → la misma revisión con ajustes pendientes y su tarea (para el equipo)
//   node manual/seed-demo-e17.cjs aprobada   → la misma revisión aprobada
const req = require("module").createRequire(__dirname + "/../package.json");
const { PrismaClient } = req("@prisma/client");
const RID = "e702b71d-d30b-4d3c-9848-11fc3d9eb407";

(async () => {
  const p = new PrismaClient();
  const mode = process.argv[2];
  const slides = await p.reviewSlide.findMany({ where: { reviewId: RID }, orderBy: { position: "asc" }, include: { assets: true } });
  const cli = await p.user.findUnique({ where: { email: "cliente.demo@311consultores.com" } });
  const reset = async () => {
    await p.reviewComment.deleteMany({ where: { reviewId: RID } });
    await p.reviewCopyVersion.deleteMany({ where: { slideId: { in: slides.map((s) => s.id) } } });
    await p.reviewAsset.deleteMany({ where: { slideId: { in: slides.map((s) => s.id) }, version: { gt: 1 } } });
    await p.reviewSlide.updateMany({ where: { reviewId: RID }, data: { status: "PENDIENTE", approvedAt: null, approvedByName: null, reopenedReason: null, copyVersion: 1, artVersion: 1 } });
    await p.reviewSlide.update({ where: { id: slides[0].id }, data: { copy: "Tu proyecto merece cimientos fuertes. Conoce nuestros productos en concreto premezclado." } });
  };
  const comment = (s, target, body, extra = {}) => p.reviewComment.create({ data: { reviewId: RID, slideId: s.id, target, round: 1, authorId: cli.id, body, ...extra } });

  if (mode === "borrador") {
    const exists = await p.review.findFirst({ where: { title: "Campaña Buen Fin" } });
    if (!exists) {
      const base = await p.review.findUnique({ where: { id: RID } });
      const client = await p.client.findFirst({ where: { companyName: { startsWith: "Cl" } }, include: { projects: true } });
      const r = await p.review.create({
        data: {
          clientId: client.id, projectId: client.projects[0].id, title: "Campaña Buen Fin", status: "BORRADOR", notifyEmails: "direccion@aurora.example",
          copyUserId: base.copyUserId, artUserId: base.artUserId, respondBy: new Date("2026-11-14T12:00:00"), createdById: base.createdById,
        },
      });
      const defs = [
        ["Este Buen Fin cuidamos tu salud con descuentos en estudios de laboratorio. 🩺", "FACEBOOK", slides[0]],
        ["3 hábitos que cambian tu semana: dormir mejor, moverte más y hacerte tu chequeo anual.", "INSTAGRAM", slides[1]],
        ["Conoce a nuestro equipo de especialistas y agenda tu cita hoy.", "FACEBOOK", slides[0]],
      ];
      for (let i = 0; i < defs.length; i++) {
        const [copy, channel, src] = defs[i];
        const s = await p.reviewSlide.create({ data: { reviewId: r.id, position: i + 1, copy, channel, publishOn: new Date(`2026-11-${15 + i}T12:00:00`) } });
        const keep = src.assets.filter((a) => a.version === 1);
        for (let k = 0; k < keep.length; k++) await p.reviewAsset.create({ data: { slideId: s.id, key: keep[k].key, type: keep[k].type, name: keep[k].name, position: k + 1 } });
      }
    }
    console.log("borrador listo");
  } else if (mode === "cliente") {
    await reset();
    await p.review.update({ where: { id: RID }, data: { status: "PUBLICADA", round: 1, approvedAt: null, approvedByName: null, startedAt: new Date(), respondBy: new Date("2026-11-12T12:00:00") } });
    await comment(slides[0], "COPY", "Cambiar «soluciones» por «productos» y agregar el teléfono 999 123 4567.");
    await comment(slides[1], "ART", "La segunda imagen se ve muy oscura, subir brillo.", { imageNo: 2 });
    console.log("estado cliente listo");
  } else if (mode === "ajustes") {
    await reset();
    await p.review.update({ where: { id: RID }, data: { status: "EN_AJUSTES", round: 1, approvedAt: null, approvedByName: null, startedAt: new Date() } });
    const sent = new Date();
    const c1 = await comment(slides[0], "COPY", "Cambiar «soluciones» por «productos» y agregar el teléfono 999 123 4567.", { sentAt: sent });
    const c2 = await comment(slides[1], "ART", "La segunda imagen se ve muy oscura, subir brillo.", { imageNo: 2, sentAt: sent });
    await p.reviewSlide.update({ where: { id: slides[0].id }, data: { status: "CAMBIOS" } });
    await p.reviewSlide.update({ where: { id: slides[1].id }, data: { status: "CAMBIOS" } });
    await p.reviewSlide.update({ where: { id: slides[2].id }, data: { status: "APROBADO", approvedAt: sent, approvedByName: cli.name } });
    // La tarea de ajustes (se reutiliza la que ya existe y se deja con sus subtareas sin marcar)
    const t = await p.task.findFirst({ where: { reviewId: RID }, include: { subtasks: { orderBy: { position: "asc" } } } });
    if (t) {
      await p.subtask.updateMany({ where: { taskId: t.id }, data: { done: false, doneAt: null, doneById: null } });
      await p.subtask.update({ where: { id: t.subtasks[0].id }, data: { reviewCommentId: c1.id, reviewSlideId: slides[0].id } });
      await p.subtask.update({ where: { id: t.subtasks[1].id }, data: { reviewCommentId: c2.id, reviewSlideId: slides[1].id } });
      await p.task.update({ where: { id: t.id }, data: { status: "PENDIENTE" } });
      console.log("tarea", t.id);
    }
    console.log("estado ajustes listo");
  } else if (mode === "aprobada") {
    await p.review.update({ where: { id: RID }, data: { status: "APROBADA", approvedAt: new Date(), approvedByName: cli.name, round: 2 } });
    await p.reviewSlide.updateMany({ where: { reviewId: RID }, data: { status: "APROBADO", approvedAt: new Date(), approvedByName: cli.name } });
    console.log("aprobada");
  }
  await p.$disconnect();
})();
