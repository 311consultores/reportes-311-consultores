import React from "react";
import { Document, Page, Text, View, Image, Link, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/storage";
import { htmlToBlocks } from "@/lib/html-blocks";
import { parseConsultants } from "@/lib/consultants";
import { readLogo, readLogo311, type LogoImage } from "@/lib/branding";
import { avatarColor, initialsOf } from "@/lib/avatar-style";
import { evidencePath } from "@/lib/evidence-link";
import { getDocsConfig } from "@/lib/docs/config";
import { FOOTER_SLOGAN } from "@/lib/docs/types";

const ACCENT = "#007AFF"; // mismo azul del sistema

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 40, paddingBottom: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: ACCENT },
  logos: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  logo: { maxHeight: 44, maxWidth: 160, objectFit: "contain" },
  brand: { fontSize: 8.5, color: ACCENT, letterSpacing: 1.2, fontFamily: "Helvetica-Bold" },
  folio: { fontSize: 24, fontFamily: "Helvetica-Bold", marginTop: 3, color: "#0f172a" },
  sub: { fontSize: 11.5, color: "#475569", marginTop: 3 },
  meta: { marginTop: 14, flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  metaCol: { flex: 1, paddingRight: 8 },
  metaLabel: { fontSize: 7.5, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  metaValue: { fontSize: 10, color: "#0f172a", lineHeight: 1.3 },
  people: { flexDirection: "row", flexWrap: "wrap" },
  person: { flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 4 },
  avatar: { width: 20, height: 20, borderRadius: 10, objectFit: "cover", marginRight: 5 },
  avatarInitials: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#ffffff", fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  personName: { fontSize: 10, color: "#0f172a" },
  sectionTitle: { marginTop: 22, marginBottom: 8, fontSize: 9, letterSpacing: 1.2, color: "#64748b", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  card: { marginBottom: 12, borderWidth: 1, borderColor: "#dbe3ee", borderRadius: 8, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", backgroundColor: "#eaf2ff", paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#cfe0fb" },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: ACCENT, color: "#ffffff", fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 5, marginRight: 9 },
  taskHeadText: { flex: 1 },
  taskTitle: { fontFamily: "Helvetica-Bold", fontSize: 11.5, color: "#0b2a5b" },
  taskDate: { marginTop: 2, fontSize: 8.5, color: "#64748b" },
  cardBody: { paddingVertical: 10, paddingHorizontal: 14 },
  p: { marginBottom: 5, lineHeight: 1.15 },
  row: { flexDirection: "row", marginBottom: 5 },
  bullet: { width: 16, lineHeight: 1.15 },
  rowText: { flex: 1, lineHeight: 1.15 },
  evidence: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, marginHorizontal: -3 },
  img: { height: 150, objectFit: "contain", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, margin: 3 },
  file: { flexDirection: "row", alignItems: "center", marginTop: 6, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe3ee", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8 },
  fileIcon: { width: 24, height: 30, borderRadius: 3, backgroundColor: "#eaf2ff", borderWidth: 1, borderColor: "#9ec3f7", alignItems: "center", justifyContent: "center", marginRight: 9 },
  fileIconText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: ACCENT },
  fileName: { fontSize: 9.5, color: ACCENT, fontFamily: "Helvetica-Bold" },
  fileHint: { fontSize: 8, color: "#64748b", marginTop: 1 },
  endBand: { marginTop: 22, backgroundColor: "#f1f5f9", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 16 },
  endTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  endLogo: { maxHeight: 24, maxWidth: 120, objectFit: "contain" },
  endBrand: { fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, color: "#0f172a" },
  endContact: { fontSize: 9, color: "#334155", textAlign: "right", lineHeight: 1.5 },
  endRule: { borderTopWidth: 0.75, borderTopColor: "#cbd5e1", marginTop: 10, marginBottom: 8 },
  endSlogan: { fontSize: 9.5, color: "#475569", textAlign: "center", marginBottom: 8 },
  endMeta: { flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#94a3b8" },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, paddingTop: 6, borderTopWidth: 0.75, borderTopColor: "#e2e8f0", fontSize: 8, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
});

const font = (b: boolean, i: boolean) =>
  b && i ? "Helvetica-BoldOblique" : b ? "Helvetica-Bold" : i ? "Helvetica-Oblique" : "Helvetica";

import { formatExecuted } from "@/lib/task-date";

const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

const src = (l: LogoImage) => ({ data: l.data, format: l.format });

/** Altura máxima de una página de PDF que todos los visores abren sin problema (en puntos; el límite de Acrobat es 14,400). */
export const MAX_PAGE_HEIGHT = 14000;
const PAGE_WIDTH = 612; // ancho carta

/**
 * PDF del reporte. «continua» = una sola hoja larga sin saltos de página (alto variable);
 * «bloques» = hojas de MAX_PAGE_HEIGHT puntos, para reportes larguísimos que no caben en una sola hoja.
 */
export async function buildReportPdf(reportId: string, baseUrl: string, mode: "continua" | "bloques" = "continua"): Promise<{ buffer: Buffer; folio: string; pageHeights: number[] }> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      client: true,
      project: true,
      createdBy: { select: { name: true } },
      tasks: { orderBy: { sequentialNum: "asc" }, include: { evidences: { orderBy: { createdAt: "asc" } } } },
    },
  });

  const [logo311, logoClient, cfg] = await Promise.all([readLogo311(), readLogo(report.client.logoUrl), getDocsConfig()]);

  // Consultores con foto: los reportes nuevos guardan los ids de los usuarios TEAM 311; los anteriores, solo nombres (iniciales)
  const names = parseConsultants(report.consultants);
  let ids: string[] = [];
  try {
    const v = report.consultantIds ? JSON.parse(report.consultantIds) : [];
    ids = Array.isArray(v) ? v.map(String) : [];
  } catch {
    ids = [];
  }
  const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, photoUrl: true } }) : [];
  const consultants = await Promise.all(
    names.map(async (n, i) => {
      const u = people.find((p) => p.id === ids[i]);
      const photo = u?.photoUrl ? await readLogo(u.photoUrl) : null; // readLogo lee cualquier imagen guardada (PNG o JPG)
      return { name: u?.name ?? n, photo };
    }),
  );

  const tasks = await Promise.all(
    report.tasks.map(async (t, idx) => {
      const images: { data: Buffer; format: "jpg" | "png"; link: string }[] = [];
      const others: { type: string; name: string; link: string }[] = [];
      for (const e of t.evidences) {
        if (e.type === "IMAGE") {
          try {
            images.push({ data: await getObject(e.url), format: e.url.endsWith(".png") ? "png" : "jpg", link: baseUrl + evidencePath(e.id) });
          } catch {
            // archivo no disponible: se omite en el PDF
          }
        } else {
          others.push({ type: e.type, name: e.url.split("/").pop() ?? e.url, link: baseUrl + evidencePath(e.id) });
        }
      }
      return { ...t, num: idx + 1, images, others, blocks: htmlToBlocks(t.descriptionHtml) };
    }),
  );

  const doc = (
    <Document title={report.folio} author="311 CONSULTORES">
      <Page size={mode === "continua" ? { width: PAGE_WIDTH } : [PAGE_WIDTH, MAX_PAGE_HEIGHT]} style={s.page}>
        <View style={s.topBar} fixed />
        {(logo311 || logoClient) && (
          <View style={s.logos}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt */}
            {logo311 ? <Image src={src(logo311)} style={s.logo} /> : <View />}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt */}
            {logoClient ? <Image src={src(logoClient)} style={s.logo} /> : <View />}
          </View>
        )}
        <Text style={s.brand}>311 CONSULTORES · REPORTE DE ACTIVIDADES</Text>
        <Text style={s.folio}>{report.folio}</Text>
        <Text style={s.sub}>
          {report.client.companyName} — {report.project.projectName}
        </Text>

        <View style={s.meta}>
          <View style={[s.metaCol, { flex: 1.5 }]}>
            <Text style={s.metaLabel}>Periodo</Text>
            <Text style={s.metaValue}>
              {fmt(report.startDate)} – {fmt(report.endDate)}
            </Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Consultores</Text>
            <View style={s.people}>
              {consultants.map((c, i) => (
                <View key={i} style={s.person} wrap={false}>
                  {c.photo ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt
                    <Image src={src(c.photo)} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.avatarInitials, { backgroundColor: avatarColor(c.name) }]}>
                      <Text style={s.avatarText}>{initialsOf(c.name)}</Text>
                    </View>
                  )}
                  <Text style={s.personName}>{c.name}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Elaborado por</Text>
            <Text style={s.metaValue}>{report.createdBy.name}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Actividades realizadas</Text>

        {tasks.map((t) => (
          <View key={t.id} style={s.card} minPresenceAhead={90}>
            {/* minPresenceAhead (en la tarjeta) evita que una actividad empiece al filo de una página con solo el encabezado */}
            <View style={s.cardHead}>
              <Text style={s.badge}>{t.num}</Text>
              <View style={s.taskHeadText}>
                <Text style={s.taskTitle}>{t.title ? t.title : `Actividad ${t.num}`}</Text>
                {formatExecuted(t.executedAt) && <Text style={s.taskDate}>{formatExecuted(t.executedAt)}</Text>}
              </View>
            </View>
            <View style={s.cardBody}>
              {t.blocks.map((b, i) =>
                b.prefix ? (
                  <View key={i} wrap={false} style={[s.row, { marginLeft: 14 * Math.floor((b.prefix.length - b.prefix.trimStart().length) / 4) }]}>
                    <Text style={s.bullet}>{b.prefix.trim()}</Text>
                    <Text style={s.rowText}>
                      {b.runs.map((r, j) => (
                        <Text key={j} style={{ fontFamily: font(r.bold, r.italic) }}>
                          {r.text}
                        </Text>
                      ))}
                    </Text>
                  </View>
                ) : (
                  <Text key={i} style={s.p}>
                    {b.runs.map((r, j) => (
                      <Text key={j} style={{ fontFamily: font(r.bold, r.italic) }}>
                        {r.text}
                      </Text>
                    ))}
                  </Text>
                ),
              )}
              {t.images.length > 0 && (
                <View style={s.evidence}>
                  {t.images.map((img, i) => (
                    // Cada imagen es clickeable: abre el archivo completo en una pestaña nueva
                    <Link key={i} src={img.link} style={{ width: t.images.length === 1 ? "62%" : "47.5%" }}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt */}
                      <Image src={{ data: img.data, format: img.format }} style={[s.img, { margin: 3, width: "100%" }]} />
                    </Link>
                  ))}
                </View>
              )}
              {t.others.map((o, i) => (
                <Link key={i} src={o.link} style={{ textDecoration: "none" }}>
                  <View style={s.file}>
                    <View style={s.fileIcon}><Text style={s.fileIconText}>{o.type === "PDF" ? "PDF" : "VIDEO"}</Text></View>
                    <View>
                      <Text style={s.fileName}>{o.type === "PDF" ? "Abrir documento PDF" : "Ver video"}</Text>
                      <Text style={s.fileHint}>Se abre en una pestaña nueva · {o.name.replace(/^[0-9a-f-]{36}-/i, "")}</Text>
                    </View>
                  </View>
                </Link>
              ))}
            </View>
          </View>
        ))}

        {/* Cierre del reporte: logo y contacto, lema, folio y periodo */}
        <View style={s.endBand} wrap={false}>
          <View style={s.endTop}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt */}
            {logo311 ? <Image src={src(logo311)} style={s.endLogo} /> : <Text style={s.endBrand}>311 CONSULTORES</Text>}
            <Text style={s.endContact}>{cfg.contactEmail}{"\n"}{cfg.contactPhones}</Text>
          </View>
          <View style={s.endRule} />
          <Text style={s.endSlogan}>{FOOTER_SLOGAN}</Text>
          <View style={s.endMeta}>
            <Text>{report.folio}</Text>
            <Text>{fmt(report.startDate)} – {fmt(report.endDate)}</Text>
          </View>
        </View>
        {mode === "continua" ? null : (
          <View style={s.footer} fixed>
            <Text>{report.folio}</Text>
            <Text render={({ pageNumber, totalPages }) => `Parte ${pageNumber} de ${totalPages}`} />
          </View>
        )}
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  // Alturas de página del PDF (se leen del propio archivo para saber si el reporte cupo en una sola hoja)
  const pageHeights = [...buffer.toString("latin1").matchAll(/\/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+([\d.]+)\s*\]/g)].map((m) => Number(m[1]));
  return { buffer, folio: report.folio, pageHeights };
}
