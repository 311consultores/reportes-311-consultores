import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getObject } from "@/lib/storage";
import { htmlToBlocks } from "@/lib/html-blocks";
import { parseConsultants } from "@/lib/consultants";

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 55, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  brand: { fontSize: 9, color: "#64748b", letterSpacing: 1 },
  folio: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 2 },
  sub: { fontSize: 11, color: "#475569", marginTop: 2 },
  meta: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#cbd5e1" },
  metaRow: { flexDirection: "row", marginBottom: 3 },
  metaLabel: { width: 80, color: "#64748b" },
  task: { marginTop: 16 },
  taskTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 4, color: "#1e293b" },
  p: { marginBottom: 3, lineHeight: 1.4 },
  img: { marginTop: 6, maxHeight: 260, objectFit: "contain", objectPositionX: 0 },
  note: { marginTop: 6, fontSize: 9, color: "#475569" },
  footer: { position: "absolute", bottom: 25, left: 40, right: 40, fontSize: 8, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
});

const font = (b: boolean, i: boolean) =>
  b && i ? "Helvetica-BoldOblique" : b ? "Helvetica-Bold" : i ? "Helvetica-Oblique" : "Helvetica";

const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

export async function buildReportPdf(reportId: string): Promise<{ buffer: Buffer; folio: string }> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: { client: true, project: true, tasks: { orderBy: { sequentialNum: "asc" } } },
  });

  const tasks = await Promise.all(
    report.tasks.map(async (t) => {
      let image: { data: Buffer; format: "jpg" | "png" } | null = null;
      if (t.evidenceType === "IMAGE" && t.evidenceUrl) {
        try {
          image = {
            data: await getObject(t.evidenceUrl),
            format: t.evidenceUrl.endsWith(".png") ? "png" : "jpg",
          };
        } catch {
          image = null;
        }
      }
      return { ...t, image, blocks: htmlToBlocks(t.descriptionHtml) };
    }),
  );

  const doc = (
    <Document title={report.folio} author="311 CONSULTORES">
      <Page size="LETTER" style={s.page}>
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
        </View>

        {tasks.map((t, idx) => (
          <View key={t.id} style={s.task}>
            <Text style={s.taskTitle}>Actividad {idx + 1}</Text>
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
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de react-pdf no admite alt */}
            {t.image && <Image src={t.image} style={s.img} />}
            {t.evidenceType && t.evidenceType !== "IMAGE" && t.evidenceUrl && (
              <Text style={s.note}>
                Evidencia ({t.evidenceType === "PDF" ? "documento PDF" : "video"}) disponible en la plataforma:{" "}
                {t.evidenceUrl.split("/").pop()}
              </Text>
            )}
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
