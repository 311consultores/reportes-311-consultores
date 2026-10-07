import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/storage";
import { htmlToBlocks } from "@/lib/html-blocks";
import { parseConsultants } from "@/lib/consultants";
import { readLogo, readLogo311, type LogoImage } from "@/lib/branding";

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 55, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  logos: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  logo: { maxHeight: 44, maxWidth: 160, objectFit: "contain" },
  brand: { fontSize: 9, color: "#64748b", letterSpacing: 1 },
  folio: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 2 },
  sub: { fontSize: 11, color: "#475569", marginTop: 2 },
  meta: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#cbd5e1" },
  metaRow: { flexDirection: "row", marginBottom: 3 },
  metaLabel: { width: 80, color: "#64748b" },
  task: { marginTop: 16 },
  taskTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 4, color: "#1e293b" },
  p: { marginBottom: 3, lineHeight: 1.4 },
  img: { marginTop: 6, maxHeight: 230, objectFit: "contain", objectPositionX: 0 },
  note: { marginTop: 6, fontSize: 9, color: "#475569" },
  footer: { position: "absolute", bottom: 25, left: 40, right: 40, fontSize: 8, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
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
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Periodo</Text>
            <Text>
              {fmt(report.startDate)} – {fmt(report.endDate)}
            </Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Consultores</Text>
            <Text>{parseConsultants(report.consultants).join(", ")}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Elaborado por</Text>
            <Text>{report.createdBy.name}</Text>
          </View>
        </View>

        {tasks.map((t) => (
          <View key={t.id} style={s.task}>
            <Text style={s.taskTitle}>{t.title ? `Actividad ${t.num} — ${t.title}` : `Actividad ${t.num}`}</Text>
            {t.blocks.map((b, i) => (
              <Text key={i} style={s.p}>
                {b.prefix}
                {b.runs.map((r, j) => (
                  <Text key={j} style={{ fontFamily: font(r.bold, r.italic) }}>
                    {r.text}
                  </Text>
                ))}
              </Text>
            ))}
            {t.images.map((img, i) => (
              // eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt
              <Image key={i} src={img} style={s.img} />
            ))}
            {t.others.map((o, i) => (
              <Text key={i} style={s.note}>
                Evidencia ({o.type}) disponible en la plataforma: {o.name}
              </Text>
            ))}
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
