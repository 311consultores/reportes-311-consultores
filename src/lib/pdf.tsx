import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/storage";
import { htmlToBlocks } from "@/lib/html-blocks";
import { parseConsultants } from "@/lib/consultants";
import { readLogo, readLogo311, type LogoImage } from "@/lib/branding";

const ACCENT = "#007AFF"; // mismo azul del sistema

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 40, paddingBottom: 55, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
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
  sectionTitle: { marginTop: 22, marginBottom: 8, fontSize: 9, letterSpacing: 1.2, color: "#64748b", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  card: { marginBottom: 12, borderWidth: 1, borderColor: "#dbe3ee", borderRadius: 8, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", backgroundColor: "#eaf2ff", paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#cfe0fb" },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: ACCENT, color: "#ffffff", fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 5, marginRight: 9 },
  taskTitle: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 11.5, color: "#0b2a5b" },
  cardBody: { paddingVertical: 10, paddingHorizontal: 14 },
  p: { marginBottom: 5, lineHeight: 1.15 },
  row: { flexDirection: "row", marginBottom: 5 },
  bullet: { width: 16, lineHeight: 1.15 },
  rowText: { flex: 1, lineHeight: 1.15 },
  evidence: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, marginHorizontal: -3 },
  img: { height: 150, objectFit: "contain", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, margin: 3 },
  note: { marginTop: 6, fontSize: 9, color: "#475569", backgroundColor: "#f8fafc", borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, paddingTop: 6, borderTopWidth: 0.75, borderTopColor: "#e2e8f0", fontSize: 8, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
});

const font = (b: boolean, i: boolean) =>
  b && i ? "Helvetica-BoldOblique" : b ? "Helvetica-Bold" : i ? "Helvetica-Oblique" : "Helvetica";

const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

const src = (l: LogoImage) => ({ data: l.data, format: l.format });

export async function buildReportPdf(reportId: string): Promise<{ buffer: Buffer; folio: string }> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      client: true,
      project: true,
      createdBy: { select: { name: true } },
      tasks: { orderBy: { sequentialNum: "asc" }, include: { evidences: { orderBy: { createdAt: "asc" } } } },
    },
  });

  const [logo311, logoClient] = await Promise.all([readLogo311(), readLogo(report.client.logoUrl)]);

  const tasks = await Promise.all(
    report.tasks.map(async (t, idx) => {
      const images: { data: Buffer; format: "jpg" | "png" }[] = [];
      const others: { type: string; name: string }[] = [];
      for (const e of t.evidences) {
        if (e.type === "IMAGE") {
          try {
            images.push({ data: await getObject(e.url), format: e.url.endsWith(".png") ? "png" : "jpg" });
          } catch {
            // archivo no disponible: se omite en el PDF
          }
        } else {
          others.push({ type: e.type === "PDF" ? "documento PDF" : "video", name: e.url.split("/").pop() ?? e.url });
        }
      }
      return { ...t, num: idx + 1, images, others, blocks: htmlToBlocks(t.descriptionHtml) };
    }),
  );

  const doc = (
    <Document title={report.folio} author="311 CONSULTORES">
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
            <Text style={s.metaValue}>{parseConsultants(report.consultants).join(", ")}</Text>
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
              <Text style={s.taskTitle}>{t.title ? t.title : `Actividad ${t.num}`}</Text>
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
                    // eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt
                    <Image key={i} src={img} style={[s.img, { width: t.images.length === 1 ? "62%" : "47.5%" }]} />
                  ))}
                </View>
              )}
              {t.others.map((o, i) => (
                <Text key={i} style={s.note}>
                  Evidencia ({o.type}) disponible en la plataforma: {o.name}
                </Text>
              ))}
            </View>
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text>{report.folio}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  return { buffer: await renderToBuffer(doc), folio: report.folio };
}
