import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/storage";
import { readLogo, readLogo311, type LogoImage } from "@/lib/branding";
import { channelLabel, fmtSec, artKind, ART_KIND_LABEL } from "@/lib/reviews";

const ACCENT = "#007AFF";
const MAX_THUMBS = 4; // imágenes por slide que se incluyen en el PDF

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 40, paddingBottom: 50, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: ACCENT },
  logos: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  logo: { maxHeight: 44, maxWidth: 160, objectFit: "contain" },
  brand: { fontSize: 8.5, color: ACCENT, letterSpacing: 1.2, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 3 },
  sub: { fontSize: 11.5, color: "#475569", marginTop: 3 },
  ok: { marginTop: 12, backgroundColor: "#e3f6e8", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, color: "#1e6e34", fontSize: 10.5 },
  meta: { marginTop: 10, flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 7.5, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  section: { marginTop: 20, marginBottom: 8, fontSize: 9, letterSpacing: 1.2, color: "#64748b", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  card: { marginBottom: 12, borderWidth: 1, borderColor: "#dbe3ee", borderRadius: 8, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", backgroundColor: "#eaf2ff", paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#cfe0fb" },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: ACCENT, color: "#fff", fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 5, marginRight: 9 },
  headTitle: { fontFamily: "Helvetica-Bold", fontSize: 11.5, color: "#0b2a5b" },
  headSub: { fontSize: 8.5, color: "#64748b", marginTop: 2 },
  body: { paddingVertical: 10, paddingHorizontal: 14 },
  label: { fontSize: 7.5, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3, marginTop: 8 },
  copy: { lineHeight: 1.3 },
  thumbs: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, marginHorizontal: -3 },
  thumb: { width: 110, height: 110, objectFit: "cover", borderRadius: 4, margin: 3, borderWidth: 1, borderColor: "#e2e8f0" },
  note: { fontSize: 9, color: "#475569", marginTop: 4 },
  comment: { marginTop: 4, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: "#f8fafc", borderRadius: 4 },
  commentHead: { fontSize: 8, color: "#64748b", marginBottom: 2 },
  resolved: { fontSize: 8.5, color: "#1e8e3e", marginTop: 2 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, paddingTop: 6, borderTopWidth: 0.75, borderTopColor: "#e2e8f0", fontSize: 8, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
});

const fmtDay = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
const fmtWhen = (d: Date) => d.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
const src = (l: LogoImage) => ({ data: l.data, format: l.format });

// Generar un PDF consume CPU y memoria: se hace uno a la vez
let chain: Promise<unknown> = Promise.resolve();
const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
};

/** PDF resumen de una revisión aprobada: cada slide con su copy, arte, comentarios por ronda y su resolución. */
export async function buildReviewPdf(reviewId: string): Promise<{ buffer: Buffer; title: string }> {
  const r = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    include: {
      client: { select: { companyName: true, logoUrl: true } },
      project: { select: { projectName: true } },
      slides: {
        orderBy: { position: "asc" },
        include: {
          assets: { orderBy: { position: "asc" } },
          comments: { where: { sentAt: { not: null } }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
        },
      },
    },
  });
  const [logo311, logoClient] = await Promise.all([readLogo311(), readLogo(r.client.logoUrl)]);

  const slides = await Promise.all(r.slides.map(async (sl) => {
    const current = sl.assets.filter((a) => a.version === sl.artVersion);
    const images: { data: Buffer; format: "jpg" | "png" }[] = [];
    for (const a of current.filter((x) => x.type === "IMAGE").slice(0, MAX_THUMBS)) {
      try { images.push({ data: await getObject(a.key), format: a.key.endsWith(".png") ? "png" : "jpg" }); } catch { /* archivo no disponible: se omite */ }
    }
    return { ...sl, current, images, kind: artKind(current) };
  }));

  const doc = (
    <Document title={`Revisión aprobada - ${r.title}`} author="311 CONSULTORES">
      <Page size="LETTER" style={s.page}>
        <View style={s.topBar} fixed />
        {(logo311 || logoClient) && (
          <View style={s.logos}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt */}
            {logo311 ? <Image src={src(logo311)} style={s.logo} /> : <View />}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt */}
            {logoClient ? <Image src={src(logoClient)} style={s.logo} /> : <View />}
          </View>
        )}
        <Text style={s.brand}>311 CONSULTORES · RESUMEN DE REVISIÓN</Text>
        <Text style={s.title}>{r.title}</Text>
        <Text style={s.sub}>{r.client.companyName} — {r.project.projectName}</Text>
        {r.approvedAt && <Text style={s.ok}>Aprobada por {r.approvedByName ?? "el cliente"} el {fmtWhen(r.approvedAt)}</Text>}
        <View style={s.meta}>
          <View style={s.metaCol}><Text style={s.metaLabel}>Slides</Text><Text>{r.slides.length}</Text></View>
          <View style={s.metaCol}><Text style={s.metaLabel}>Rondas de revisión</Text><Text>{r.round}</Text></View>
          <View style={s.metaCol}><Text style={s.metaLabel}>Publicada</Text><Text>{r.publishedAt ? fmtWhen(r.publishedAt) : "—"}</Text></View>
        </View>

        <Text style={s.section}>Contenido aprobado</Text>
        {slides.map((sl) => (
          <View key={sl.id} style={s.card} minPresenceAhead={120}>
            <View style={s.head}>
              <Text style={s.badge}>{sl.position}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.headTitle}>Slide {sl.position} · {channelLabel(sl.channel)}{sl.publishOn ? ` · Publicación ${fmtDay(sl.publishOn)}` : ""}</Text>
                <Text style={s.headSub}>{ART_KIND_LABEL[sl.kind]} · copy v{sl.copyVersion} · arte v{sl.artVersion}{sl.approvedByName ? ` · aprobado por ${sl.approvedByName}` : ""}</Text>
              </View>
            </View>
            <View style={s.body}>
              <Text style={s.label}>Copy</Text>
              <Text style={s.copy}>{sl.copy}</Text>
              <Text style={s.label}>Arte</Text>
              {sl.images.length > 0 && (
                <View style={s.thumbs}>
                  {sl.images.map((img, i) => (
                    // eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt
                    <Image key={i} src={img} style={s.thumb} />
                  ))}
                </View>
              )}
              {sl.kind === "VIDEO" && <Text style={s.note}>Video: {sl.current[0]?.name} (no se incluye en el PDF; está disponible en el portal)</Text>}
              {sl.current.filter((x) => x.type === "IMAGE").length > MAX_THUMBS && <Text style={s.note}>+ {sl.current.filter((x) => x.type === "IMAGE").length - MAX_THUMBS} imagen(es) más en el portal</Text>}
              {sl.comments.length > 0 && <Text style={s.label}>Comentarios y ajustes</Text>}
              {sl.comments.map((c) => (
                <View key={c.id} style={s.comment} wrap={false}>
                  <Text style={s.commentHead}>
                    Ronda {c.round} · {c.target === "COPY" ? "Copy" : "Arte"}{c.imageNo ? ` · imagen ${c.imageNo}` : ""}{c.videoSec != null ? ` · video ${fmtSec(c.videoSec)}` : ""} · {c.author.name} · {c.sentAt ? fmtWhen(c.sentAt) : ""}
                  </Text>
                  <Text>{c.body}</Text>
                  {c.resolvedAt && <Text style={s.resolved}>Resuelto{c.resolvedNote ? `: ${c.resolvedNote}` : ""}</Text>}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text>{r.title}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return { buffer: await exclusive(() => renderToBuffer(doc)), title: r.title };
}
