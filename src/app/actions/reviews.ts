"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { deleteObject } from "@/lib/storage";
import { getBaseUrl } from "@/lib/base-url";
import { readLogo311 } from "@/lib/branding";
import { sendMail } from "@/lib/mailer";
import { reviewAdjustedEmail, reviewPublishedEmail, tareaAsignadaEmail } from "@/lib/email-templates";
import { formatMx } from "@/lib/tasks-shared";
import { notifyUsers, taskManagerIds } from "@/lib/notifications";
import { splitEmails, uniqueEmails, isEmail } from "@/lib/emails";
import { fmtDate, isValidIsoDate } from "@/lib/finance";
import { fmtSec, MAX_ASSETS, MAX_COMMENT, MAX_COPY, REVIEW_CREATORS, REVIEW_STAFF, reviewScope, reviewWhatsappMessage } from "@/lib/reviews";

type Res = { error?: string; ok?: boolean };
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
const refresh = (id: string) => {
  revalidatePath("/revisiones");
  revalidatePath(`/revisiones/${id}`);
};

/** Revisión que la persona puede ver y modificar como equipo. */
async function staffReview(id: string) {
  const user = await requireUser([...REVIEW_STAFF]);
  const review = isUuid(id) ? await prisma.review.findFirst({ where: { id, ...reviewScope(user) } }) : null;
  if (!review) throw new Error("Revisión no encontrada");
  return { user, review };
}

/** Slide al que el equipo puede cambiar copy o arte: en borrador, o con la revisión en ajustes mientras el slide esté por corregir. */
async function adjustableSlide(slideId: string, mode: "any" | "adjust") {
  const user = await requireUser([...REVIEW_STAFF]);
  const slide = isUuid(slideId) ? await prisma.reviewSlide.findUnique({ where: { id: slideId }, include: { review: true, assets: true } }) : null;
  if (!slide) return { error: "Slide no encontrado" };
  const ok = await prisma.review.findFirst({ where: { id: slide.reviewId, ...reviewScope(user) }, select: { id: true } });
  if (!ok) return { error: "Slide no encontrado" };
  const inAdjust = slide.review.status === "EN_AJUSTES" && (slide.status === "CAMBIOS" || slide.status === "PENDIENTE");
  if (mode === "adjust" ? !inAdjust : slide.review.status !== "BORRADOR" && !inAdjust) return { error: "Este slide ya no se puede cambiar ahora" };
  return { user, slide };
}

async function draftSlide(slideId: string) {
  const user = await requireUser([...REVIEW_STAFF]);
  const slide = isUuid(slideId) ? await prisma.reviewSlide.findUnique({ where: { id: slideId }, include: { review: true, assets: true } }) : null;
  if (!slide) throw new Error("Slide no encontrado");
  const ok = await prisma.review.findFirst({ where: { id: slide.reviewId, ...reviewScope(user) }, select: { id: true } });
  if (!ok) throw new Error("Slide no encontrado");
  if (slide.review.status !== "BORRADOR") throw new Error("La revisión ya está publicada: ya no se pueden cambiar sus slides");
  return { user, slide };
}

// ---------- Equipo: crear y armar ----------
const metaSchema = z.object({
  title: z.string().trim().min(3, "Escribe el título de la revisión").max(191, "El título es demasiado largo"),
  copyUserId: z.string().uuid("Elige quién atiende los ajustes de COPY"),
  artUserId: z.string().uuid("Elige quién atiende los ajustes de ARTE"),
  respondBy: z.string().refine(isValidIsoDate, "Indica la fecha límite de respuesta del cliente"),
  notifyEmails: z.string(),
});

async function checkMeta(raw: Record<string, unknown>): Promise<{ error: string } | { data: { title: string; copyUserId: string; artUserId: string; respondBy: string; notifyEmails: string } }> {
  const parsed = metaSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const emails = uniqueEmails(splitEmails(d.notifyEmails));
  if (emails.length === 0) return { error: "Agrega al menos un correo para avisar al cliente" };
  if (!emails.every(isEmail)) return { error: "Hay un correo no válido en la lista de avisos" };
  const team = await prisma.user.findMany({ where: { id: { in: [d.copyUserId, d.artUserId] }, role: "TEAM_311", active: true }, select: { id: true } });
  if (!team.some((t) => t.id === d.copyUserId) || !team.some((t) => t.id === d.artUserId)) return { error: "Los responsables deben ser personas activas del TEAM 311" };
  return { data: { ...d, notifyEmails: emails.join(",") } };
}

export async function createReview(_p: Res | undefined, fd: FormData): Promise<Res> {
  const user = await requireUser([...REVIEW_CREATORS]);
  const ids = z.object({ clientId: z.string().uuid("Elige un cliente"), projectId: z.string().uuid("Elige un proyecto") }).safeParse(Object.fromEntries(fd));
  if (!ids.success) return { error: ids.error.issues[0].message };
  const project = await prisma.project.findFirst({ where: { id: ids.data.projectId, clientId: ids.data.clientId } });
  if (!project) return { error: "El proyecto no pertenece al cliente" };
  const meta = await checkMeta(Object.fromEntries(fd));
  if ("error" in meta) return { error: meta.error };
  const d = meta.data;
  const review = await prisma.review.create({
    data: {
      clientId: ids.data.clientId, projectId: project.id, title: d.title, copyUserId: d.copyUserId, artUserId: d.artUserId,
      notifyEmails: d.notifyEmails, respondBy: new Date(`${d.respondBy}T12:00:00`), createdById: user.id,
    },
  });
  revalidatePath("/revisiones");
  redirect(`/revisiones/${review.id}`);
}

/** Cambia el título, responsables, correos y fecha límite (mientras la revisión no esté aprobada). */
export async function updateReviewMeta(id: string, input: Record<string, string>): Promise<Res> {
  const { review } = await staffReview(id);
  if (review.status === "APROBADA") return { error: "La revisión ya está aprobada" };
  const meta = await checkMeta(input);
  if ("error" in meta) return { error: meta.error };
  const d = meta.data;
  await prisma.review.update({ where: { id }, data: { title: d.title, copyUserId: d.copyUserId, artUserId: d.artUserId, notifyEmails: d.notifyEmails, respondBy: new Date(`${d.respondBy}T12:00:00`) } });
  refresh(id);
  return { ok: true };
}

export async function addSlide(reviewId: string) {
  const { review } = await staffReview(reviewId);
  if (review.status !== "BORRADOR") throw new Error("La revisión ya está publicada");
  const last = await prisma.reviewSlide.aggregate({ where: { reviewId }, _max: { position: true } });
  const slide = await prisma.reviewSlide.create({ data: { reviewId, position: (last._max.position ?? 0) + 1, copy: "" } });
  return { id: slide.id, position: slide.position, channel: slide.channel, publishOn: null as string | null, copy: "", assets: [] as { id: string; type: string; name: string }[] };
}

/** Autoguardado del copy, canal y fecha de publicación de un slide. */
export async function saveSlide(slideId: string, input: { copy: string; channel: string; publishOn: string | null }): Promise<Res> {
  const { slide } = await draftSlide(slideId);
  if (input.copy.length > MAX_COPY) return { error: `El copy no puede pasar de ${MAX_COPY} caracteres` };
  if (input.channel !== "FACEBOOK" && input.channel !== "INSTAGRAM") return { error: "Canal no válido" };
  if (input.publishOn && !isValidIsoDate(input.publishOn)) return { error: "Fecha de publicación no válida" };
  await prisma.reviewSlide.update({ where: { id: slide.id }, data: { copy: input.copy, channel: input.channel, publishOn: input.publishOn ? new Date(`${input.publishOn}T12:00:00`) : null } });
  return { ok: true };
}

export async function deleteSlide(slideId: string): Promise<Res> {
  const { slide } = await draftSlide(slideId);
  await prisma.reviewSlide.delete({ where: { id: slide.id } });
  await Promise.all(slide.assets.map((a) => deleteObject(a.key).catch(() => {})));
  const rest = await prisma.reviewSlide.findMany({ where: { reviewId: slide.reviewId }, orderBy: { position: "asc" } });
  await prisma.$transaction(rest.map((s, i) => prisma.reviewSlide.update({ where: { id: s.id }, data: { position: i + 1 } })));
  refresh(slide.reviewId);
  return { ok: true };
}

export async function reorderSlides(reviewId: string, orderedIds: string[]): Promise<Res> {
  const { review } = await staffReview(reviewId);
  if (review.status !== "BORRADOR") return { error: "La revisión ya está publicada" };
  const current = await prisma.reviewSlide.findMany({ where: { reviewId }, select: { id: true } });
  if (orderedIds.length !== current.length || new Set(orderedIds).size !== current.length || !current.every((s) => orderedIds.includes(s.id))) {
    return { error: "La lista de slides cambió; recarga la página e inténtalo de nuevo" };
  }
  await prisma.$transaction(orderedIds.map((id, i) => prisma.reviewSlide.update({ where: { id }, data: { position: i + 1 } })));
  return { ok: true };
}

export async function deleteAsset(assetId: string): Promise<Res> {
  const asset = isUuid(assetId) ? await prisma.reviewAsset.findUnique({ where: { id: assetId } }) : null;
  if (!asset) return { error: "Archivo no encontrado" };
  const loaded = await adjustableSlide(asset.slideId, "any");
  if ("error" in loaded) return { error: loaded.error };
  const { slide } = loaded;
  if (slide.review.status !== "BORRADOR" && asset.version <= slide.artVersion) return { error: "Solo se puede quitar el arte nuevo que todavía no se aplica" };
  await prisma.reviewAsset.delete({ where: { id: asset.id } });
  await deleteObject(asset.key).catch(() => {});
  const rest = await prisma.reviewAsset.findMany({ where: { slideId: slide.id, version: asset.version }, orderBy: { position: "asc" } });
  await prisma.$transaction(rest.map((a, i) => prisma.reviewAsset.update({ where: { id: a.id }, data: { position: i + 1 } })));
  refresh(slide.reviewId);
  return { ok: true };
}

/** Mueve una imagen del carrusel una posición hacia arriba (-1) o abajo (1). */
export async function moveAsset(assetId: string, dir: -1 | 1): Promise<Res> {
  const asset = isUuid(assetId) ? await prisma.reviewAsset.findUnique({ where: { id: assetId } }) : null;
  if (!asset) return { error: "Archivo no encontrado" };
  await draftSlide(asset.slideId);
  const all = await prisma.reviewAsset.findMany({ where: { slideId: asset.slideId }, orderBy: { position: "asc" } });
  const i = all.findIndex((a) => a.id === assetId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return {};
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((a, k) => prisma.reviewAsset.update({ where: { id: a.id }, data: { position: k + 1 } })));
  return { ok: true };
}

/** Publica la revisión al cliente: valida que todo esté completo y le avisa por correo. */
export async function publishReview(reviewId: string): Promise<Res & { dryRun?: boolean }> {
  const { user, review } = await staffReview(reviewId);
  if (review.status !== "BORRADOR") return { error: "La revisión ya está publicada" };
  const full = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    include: { client: { select: { companyName: true } }, slides: { orderBy: { position: "asc" }, include: { assets: true } } },
  });
  if (full.slides.length === 0) return { error: "Agrega al menos un slide antes de publicar" };
  const incomplete = full.slides.filter((s) => !s.copy.trim() || s.assets.length === 0).map((s) => s.position);
  if (incomplete.length) return { error: `Estos slides necesitan copy y arte antes de publicar: ${incomplete.join(", ")}` };
  if (!full.respondBy) return { error: "Indica la fecha límite de respuesta del cliente" };

  await prisma.review.update({ where: { id: reviewId }, data: { status: "PUBLICADA", publishedAt: new Date(), round: 1 } });
  refresh(reviewId);

  // El aviso al cliente no debe impedir que la revisión quede publicada
  let dryRun = false;
  try {
    const logo = await readLogo311();
    const mail = reviewPublishedEmail({
      clientName: full.client.companyName, title: full.title, slideCount: full.slides.length, respondBy: fmtDate(full.respondBy),
      link: `${await getBaseUrl()}/revisiones/${full.id}`, withLogo: !!logo,
    });
    const r = await sendMail({
      to: splitEmails(full.notifyEmails), ...mail,
      inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined,
    });
    dryRun = !!r.dryRun;
  } catch (e) {
    console.error("[revisiones] no se pudo avisar al cliente:", e);
    return { ok: true, error: "La revisión quedó publicada, pero no se pudo enviar el correo al cliente. Avísale por otro medio." };
  }
  void user;
  return { ok: true, dryRun };
}

/** El equipo vuelve a abrir un slide aprobado (con motivo). */
export async function reopenSlide(slideId: string, reason: string): Promise<Res> {
  const user = await requireUser([...REVIEW_STAFF]);
  const slide = isUuid(slideId) ? await prisma.reviewSlide.findUnique({ where: { id: slideId } }) : null;
  const review = slide ? await prisma.review.findFirst({ where: { id: slide.reviewId, ...reviewScope(user) } }) : null;
  if (!slide || !review) return { error: "Slide no encontrado" };
  if (slide.status !== "APROBADO") return { error: "El slide no está aprobado" };
  const why = reason.trim();
  if (why.length < 3) return { error: "Indica el motivo para reabrir el slide" };
  await prisma.$transaction([
    prisma.reviewSlide.update({ where: { id: slide.id }, data: { status: "PENDIENTE", approvedAt: null, approvedByName: null, reopenedReason: why.slice(0, 500) } }),
    prisma.review.update({ where: { id: review.id }, data: { status: review.status === "APROBADA" ? "PUBLICADA" : review.status, approvedAt: null, approvedByName: null } }),
  ]);
  refresh(review.id);
  return { ok: true };
}

// ---------- Cliente: revisar ----------
async function clientReview(reviewId: string) {
  const user = await requireUser(["CLIENTE"]);
  const review = isUuid(reviewId) ? await prisma.review.findFirst({ where: { id: reviewId, ...reviewScope(user) } }) : null;
  if (!review) throw new Error("Revisión no encontrada");
  return { user, review };
}

/** La primera vez que el cliente pulsa «Iniciar revisión». */
export async function startReview(reviewId: string): Promise<Res> {
  const { review } = await clientReview(reviewId);
  if (!review.startedAt) await prisma.review.update({ where: { id: reviewId }, data: { startedAt: new Date() } });
  refresh(reviewId);
  return { ok: true };
}

type CommentInput = { id?: string; slideId: string; target: "COPY" | "ART"; body: string; imageNo?: number | null; videoSec?: number | null };

/** Autoguardado de un comentario del cliente (borrador hasta que envíe sus ajustes). */
export async function saveComment(input: CommentInput): Promise<Res & { id?: string }> {
  const user = await requireUser(["CLIENTE"]);
  const slide = isUuid(input.slideId) ? await prisma.reviewSlide.findUnique({ where: { id: input.slideId }, include: { review: true } }) : null;
  const review = slide ? await prisma.review.findFirst({ where: { id: slide.reviewId, ...reviewScope(user) } }) : null;
  if (!slide || !review) return { error: "Slide no encontrado" };
  if (review.status !== "PUBLICADA") return { error: "Esta revisión ya no admite comentarios" };
  if (slide.status !== "PENDIENTE" && slide.status !== "AJUSTADO") return { error: "Este slide ya no admite comentarios" };
  if (input.target !== "COPY" && input.target !== "ART") return { error: "Comentario no válido" };
  const body = input.body.trim();
  if (!body) return { error: "Escribe el comentario" };
  if (body.length > MAX_COMMENT) return { error: `El comentario no puede pasar de ${MAX_COMMENT} caracteres` };
  const data = {
    body,
    imageNo: input.target === "ART" && input.imageNo && input.imageNo >= 1 && input.imageNo <= MAX_ASSETS ? Math.floor(input.imageNo) : null,
    videoSec: input.target === "ART" && input.videoSec != null && input.videoSec >= 0 && input.videoSec <= 99999 ? Math.floor(input.videoSec) : null,
  };
  if (input.id) {
    const mine = await prisma.reviewComment.findFirst({ where: { id: input.id, slideId: slide.id, authorId: user.id, sentAt: null } });
    if (!mine) return { error: "Ese comentario ya se envió o no existe" };
    await prisma.reviewComment.update({ where: { id: mine.id }, data });
    return { ok: true, id: mine.id };
  }
  const c = await prisma.reviewComment.create({ data: { ...data, reviewId: review.id, slideId: slide.id, target: input.target, round: review.round, authorId: user.id } });
  return { ok: true, id: c.id };
}

export async function deleteComment(commentId: string): Promise<Res> {
  const user = await requireUser(["CLIENTE"]);
  const c = isUuid(commentId) ? await prisma.reviewComment.findFirst({ where: { id: commentId, authorId: user.id, sentAt: null } }) : null;
  if (!c) return { error: "Ese comentario ya se envió o no existe" };
  await prisma.reviewComment.delete({ where: { id: c.id } });
  return { ok: true };
}

/** Personas del equipo a las que se avisa de lo que hace el cliente. */
async function teamRecipients(review: { copyUserId: string | null; artUserId: string | null }, extra: (string | null)[] = []) {
  const managers = await taskManagerIds();
  return [...new Set([...managers, ...extra, review.copyUserId, review.artUserId].filter((x): x is string => !!x))];
}

/** El cliente aprueba un slide: queda bloqueado. Si ya están todos aprobados, la revisión se cierra con registro. */
export async function approveSlide(slideId: string): Promise<Res & { allApproved?: boolean }> {
  const user = await requireUser(["CLIENTE"]);
  const slide = isUuid(slideId) ? await prisma.reviewSlide.findUnique({ where: { id: slideId } }) : null;
  const review = slide ? await prisma.review.findFirst({ where: { id: slide.reviewId, ...reviewScope(user) } }) : null;
  if (!slide || !review) return { error: "Slide no encontrado" };
  if (review.status !== "PUBLICADA") return { error: "Esta revisión ya no admite cambios" };
  if (slide.status !== "PENDIENTE" && slide.status !== "AJUSTADO") return { error: "Este slide no se puede aprobar ahora" };
  const drafts = await prisma.reviewComment.count({ where: { slideId, sentAt: null } });
  if (drafts > 0) return { error: "Este slide tiene comentarios sin enviar. Elimínalos para poder aprobarlo, o envía tus ajustes." };

  await prisma.reviewSlide.update({ where: { id: slideId }, data: { status: "APROBADO", approvedAt: new Date(), approvedByName: user.name } });
  const open = await prisma.reviewSlide.count({ where: { reviewId: review.id, status: { not: "APROBADO" } } });
  if (open === 0) {
    await prisma.review.update({ where: { id: review.id }, data: { status: "APROBADA", approvedAt: new Date(), approvedByName: user.name } });
    await notifyUsers(await teamRecipients(review), { actorId: user.id, kind: "REVIEW_APPROVED", title: `Revisión aprobada: ${review.title}`, body: `${user.name} aprobó todos los slides`, link: `/revisiones/${review.id}` });
  }
  refresh(review.id);
  return { ok: true, allApproved: open === 0 };
}

/** El cliente envía todos sus comentarios: empieza el trabajo del equipo. */
export async function sendAdjustments(reviewId: string): Promise<Res & { count?: number }> {
  const { user, review } = await clientReview(reviewId);
  if (review.status !== "PUBLICADA") return { error: "Esta revisión ya no admite cambios" };
  const slides = await prisma.reviewSlide.findMany({ where: { reviewId }, orderBy: { position: "asc" }, select: { id: true, position: true, status: true } });
  const drafts = await prisma.reviewComment.findMany({ where: { reviewId, sentAt: null } });
  if (drafts.length === 0) return { error: "No tienes comentarios para enviar. Si todo está bien, aprueba los slides." };
  const withDraft = new Set(drafts.map((d) => d.slideId));
  const untouched = slides.filter((s) => s.status !== "APROBADO" && !withDraft.has(s.id)).map((s) => s.position);
  if (untouched.length) return { error: `Antes de enviar, revisa estos slides (apruébalos o coméntalos): ${untouched.join(", ")}` };

  const now = new Date();
  await prisma.$transaction([
    prisma.reviewComment.updateMany({ where: { reviewId, sentAt: null }, data: { sentAt: now, round: review.round } }),
    prisma.reviewSlide.updateMany({ where: { id: { in: [...withDraft] } }, data: { status: "CAMBIOS" } }),
    prisma.review.update({ where: { id: reviewId }, data: { status: "EN_AJUSTES" } }),
  ]);

  const copyN = drafts.filter((d) => d.target === "COPY").length;
  const artN = drafts.filter((d) => d.target === "ART").length;
  const owners = await createAdjustmentTask(review, drafts, slides);
  // Quien atiende los ajustes ya recibe el aviso de su tarea; aquí solo se avisa a quienes gestionan
  await notifyUsers((await teamRecipients(review)).filter((id) => !owners.includes(id)), {
    actorId: user.id, kind: "REVIEW_SENT", title: `${user.name} envió ajustes: ${review.title}`,
    body: `${copyN} de copy · ${artN} de arte (ronda ${review.round})`, link: `/revisiones/${reviewId}`,
  });
  refresh(reviewId);
  return { ok: true, count: drafts.length };
}

// ---------- Tarea de ajustes (una por ronda, con una subtarea por comentario) ----------
type ReviewRow = NonNullable<Awaited<ReturnType<typeof prisma.review.findFirst>>>;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const snippet = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Crea la tarea del equipo por los ajustes del cliente. Devuelve a quién se asignó. */
async function createAdjustmentTask(
  review: ReviewRow,
  comments: { id: string; slideId: string; target: "COPY" | "ART"; body: string; imageNo: number | null; videoSec: number | null; createdAt: Date }[],
  slides: { id: string; position: number }[],
): Promise<string[]> {
  const area = await prisma.area.upsert({ where: { name: "REDES Y ADS" }, create: { name: "REDES Y ADS", color: "#AF52DE" }, update: {} });
  const pos = new Map(slides.map((s) => [s.id, s.position]));
  const sorted = [...comments].sort((a, b) => (pos.get(a.slideId)! - pos.get(b.slideId)!) || (a.target === b.target ? a.createdAt.getTime() - b.createdAt.getTime() : a.target === "COPY" ? -1 : 1));
  const ownerOf = (t: "COPY" | "ART") => (t === "COPY" ? review.copyUserId : review.artUserId);
  const owners = [...new Set(sorted.map((c) => ownerOf(c.target)).filter((x): x is string => !!x))];
  const assignees = owners.length ? owners : [review.createdById];
  const title = `Ajustes · ${review.title} · Ronda ${review.round}`.slice(0, 191);
  const due = new Date(Date.now() + 48 * 3600_000);
  const link = `${await getBaseUrl()}/revisiones/${review.id}`;

  const task = await prisma.task.create({
    data: {
      clientId: review.clientId, projectId: review.projectId, areaId: area.id, title,
      descriptionHtml: `<p>El cliente envió ajustes en la revisión <strong>${esc(review.title)}</strong> (ronda ${review.round}). Cada subtarea abre el slide que hay que corregir.</p><p>${esc(link)}</p>`,
      dueAt: due, createdById: review.createdById, reviewId: review.id, reviewRound: review.round,
      assignees: { create: assignees.map((userId) => ({ userId })) },
      subtasks: {
        create: sorted.map((c, i) => ({
          title: `Slide ${pos.get(c.slideId)} · ${c.target === "COPY" ? "COPY" : "ARTE"}${c.imageNo ? ` (imagen ${c.imageNo})` : ""}${c.videoSec != null ? ` (video ${fmtSec(c.videoSec)})` : ""} — ${snippet(c.body.replace(/\s+/g, " "), 120)}`.slice(0, 191),
          assigneeId: ownerOf(c.target), position: i, reviewSlideId: c.slideId, reviewCommentId: c.id,
        })),
      },
      events: { create: { userId: review.createdById, kind: "CREATED", note: "Generada por los ajustes que envió el cliente" } },
    },
    include: { client: { select: { companyName: true } }, project: { select: { projectName: true } }, assignees: { include: { user: { select: { email: true, name: true } } } } },
  });

  await notifyUsers(assignees, { kind: "TASK_ASSIGNED", title: `Nueva tarea: ${task.title}`, body: `${task.client.companyName} · ${task.project.projectName} — entrega ${formatMx(task.dueAt)}`, link: `/tareas?tarea=${task.id}` });
  try {
    const logo = await readLogo311();
    const taskUrl = `${await getBaseUrl()}/tareas?tarea=${task.id}`;
    await sendMail({
      to: task.assignees.map((a) => a.user.email),
      ...tareaAsignadaEmail({ title: task.title, clientName: task.client.companyName, projectName: task.project.projectName, due: formatMx(task.dueAt), byName: "Revisiones", link: taskUrl, withLogo: !!logo }),
      inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined,
    });
  } catch (e) {
    console.error("[revisiones] no se pudo avisar de la tarea:", e);
  }
  revalidatePath("/tareas");
  return assignees;
}

/** Ajustes de la ronda en curso: cuántos faltan por hacer y qué tipo son. */
async function roundStatus(review: { id: string; round: number }) {
  const list = await prisma.reviewComment.findMany({ where: { reviewId: review.id, round: review.round, sentAt: { not: null } }, include: { slide: { select: { position: true } } }, orderBy: { createdAt: "asc" } });
  return { list, pending: list.filter((c) => !c.resolvedAt).length, copy: list.some((c) => c.target === "COPY"), art: list.some((c) => c.target === "ART") };
}

/** Marca (o desmarca) un ajuste como hecho; se refleja en la subtarea de la tarea. */
export async function resolveComment(commentId: string, done: boolean, note?: string): Promise<Res & { pending?: number }> {
  const user = await requireUser([...REVIEW_STAFF]);
  const c = isUuid(commentId) ? await prisma.reviewComment.findUnique({ where: { id: commentId } }) : null;
  const review = c ? await prisma.review.findFirst({ where: { id: c.reviewId, ...reviewScope(user) } }) : null;
  if (!c || !review) return { error: "Comentario no encontrado" };
  if (review.status !== "EN_AJUSTES" || !c.sentAt || c.round !== review.round) return { error: "Este ajuste ya no se puede cambiar" };
  const cleanNote = note?.trim().slice(0, 500) || null;
  await prisma.$transaction([
    prisma.reviewComment.update({ where: { id: c.id }, data: { resolvedAt: done ? new Date() : null, resolvedById: done ? user.id : null, resolvedNote: done ? cleanNote : null } }),
    prisma.subtask.updateMany({ where: { reviewCommentId: c.id }, data: { done, doneAt: done ? new Date() : null, doneById: done ? user.id : null } }),
  ]);
  refresh(review.id);
  revalidatePath("/tareas");
  return { ok: true, pending: (await roundStatus(review)).pending };
}

/** Guarda una versión nueva del copy (la anterior queda en el historial). */
export async function saveSlideCopy(slideId: string, text: string): Promise<Res> {
  const loaded = await adjustableSlide(slideId, "adjust");
  if ("error" in loaded) return { error: loaded.error };
  const { slide } = loaded;
  const next = text.trim();
  if (!next) return { error: "El copy no puede quedar vacío" };
  if (next.length > MAX_COPY) return { error: `El copy no puede pasar de ${MAX_COPY} caracteres` };
  if (next === slide.copy.trim()) return { ok: true };
  await prisma.$transaction([
    prisma.reviewCopyVersion.create({ data: { slideId: slide.id, version: slide.copyVersion, text: slide.copy } }),
    prisma.reviewSlide.update({ where: { id: slide.id }, data: { copy: next, copyVersion: slide.copyVersion + 1 } }),
  ]);
  refresh(slide.reviewId);
  return { ok: true };
}

/** El arte nuevo (ya subido) pasa a ser el que ve el cliente; el anterior queda en el historial. */
export async function applyNewArt(slideId: string): Promise<Res> {
  const loaded = await adjustableSlide(slideId, "adjust");
  if ("error" in loaded) return { error: loaded.error };
  const { slide } = loaded;
  if (!slide.assets.some((a) => a.version === slide.artVersion + 1)) return { error: "Primero sube el arte nuevo" };
  await prisma.reviewSlide.update({ where: { id: slide.id }, data: { artVersion: slide.artVersion + 1 } });
  refresh(slide.reviewId);
  return { ok: true };
}

/** Descarta el arte nuevo que todavía no se aplica. */
export async function discardNewArt(slideId: string): Promise<Res> {
  const loaded = await adjustableSlide(slideId, "adjust");
  if ("error" in loaded) return { error: loaded.error };
  const { slide } = loaded;
  const pending = slide.assets.filter((a) => a.version > slide.artVersion);
  await prisma.reviewAsset.deleteMany({ where: { id: { in: pending.map((a) => a.id) } } });
  await Promise.all(pending.map((a) => deleteObject(a.key).catch(() => {})));
  refresh(slide.reviewId);
  return { ok: true };
}

/** Datos para avisar al cliente (botón «Enviar al cliente» y mensaje de WhatsApp). */
export async function getSendInfo(reviewId: string): Promise<{ error: string } | { pending: number; message: string; title: string }> {
  const { review } = await staffReview(reviewId);
  const full = await prisma.review.findUniqueOrThrow({ where: { id: reviewId }, include: { client: { select: { companyName: true } } } });
  const st = await roundStatus(review);
  const link = `${await getBaseUrl()}/revisiones/${review.id}`;
  return { pending: st.pending, title: review.title, message: reviewWhatsappMessage(full.client.companyName, { copy: st.copy, art: st.art }, review.title, link) };
}

/** El equipo devuelve los ajustes al cliente: los slides corregidos pasan a «Ajustado» y empieza una ronda nueva. */
export async function sendToClient(reviewId: string): Promise<Res & { dryRun?: boolean }> {
  const { review } = await staffReview(reviewId);
  if (review.status !== "EN_AJUSTES") return { error: "Esta revisión no tiene ajustes pendientes de enviar" };
  const st = await roundStatus(review);
  if (st.pending > 0) return { error: `Todavía faltan ${st.pending} ajuste(s) por marcar como hechos` };
  const full = await prisma.review.findUniqueOrThrow({ where: { id: reviewId }, include: { client: { select: { companyName: true } } } });

  await prisma.$transaction([
    prisma.reviewSlide.updateMany({ where: { reviewId, status: "CAMBIOS" }, data: { status: "AJUSTADO" } }),
    prisma.review.update({ where: { id: reviewId }, data: { status: "PUBLICADA", round: review.round + 1 } }),
  ]);
  refresh(reviewId);

  try {
    const logo = await readLogo311();
    const mail = reviewAdjustedEmail({
      clientName: full.client.companyName, title: review.title, round: review.round,
      items: st.list.map((c) => `Slide ${c.slide.position} · ${c.target === "COPY" ? "Copy" : "Arte"}: ${snippet(c.body.replace(/\s+/g, " "), 100)}`),
      link: `${await getBaseUrl()}/revisiones/${review.id}`, withLogo: !!logo,
    });
    const r = await sendMail({ to: splitEmails(review.notifyEmails), ...mail, inline: logo ? [{ cid: "logo311", content: logo.data, contentType: logo.contentType, filename: `logo.${logo.format}` }] : undefined });
    return { ok: true, dryRun: !!r.dryRun };
  } catch (e) {
    console.error("[revisiones] no se pudo avisar al cliente:", e);
    return { ok: true, error: "Los ajustes quedaron enviados al cliente en el portal, pero no se pudo mandar el correo. Avísale por WhatsApp." };
  }
}
