// Dibujo de los documentos en PDF con @react-pdf/renderer (tipos de letra incluidos en el PDF: Times y Helvetica).
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { dateReceipt, moneyShort, type DocBlock, type Run, type TextDoc } from "@/lib/docs/text";
import type { ReciboView } from "@/lib/docs/templates";

type Img = { data: Buffer; format: "png" | "jpg" } | null;

// Los contratos no llevan palabras cortadas con guion al final del renglón (el motor las corta en inglés por defecto)
Font.registerHyphenationCallback((word) => [word]);

// ---------- Documentos de texto (contratos y acuerdos): hoja oficio, Times 12, texto justificado ----------
const t = StyleSheet.create({
  page: { paddingTop: 70, paddingBottom: 80, paddingLeft: 82, paddingRight: 82, fontSize: 12, fontFamily: "Times-Roman", color: "#000", lineHeight: 1.15 },
  title: { fontFamily: "Times-Bold", fontSize: 13, textAlign: "center", marginBottom: 14 },
  center: { fontFamily: "Times-Bold", textAlign: "center", marginTop: 6, marginBottom: 8 },
  h: { marginTop: 8, marginBottom: 6 },
  p: { marginBottom: 8 },
  liRow: { flexDirection: "row", marginBottom: 5, paddingLeft: 18 },
  liMark: { width: 20 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 26 },
  signCol: { width: "48%", textAlign: "center" },
});

const font = (r: Run, base: "Times" = "Times") => (r.b && r.i ? `${base}-BoldItalic` : r.b ? `${base}-Bold` : r.i ? `${base}-Italic` : `${base}-Roman`);

const Runs = ({ runs, bold }: { runs: Run[]; bold?: boolean }) => (
  <>
    {runs.map((r, i) => (
      <Text key={i} style={{ fontFamily: font({ ...r, b: r.b || bold }) }}>{r.t}</Text>
    ))}
  </>
);

const align = (a?: "j" | "l" | "r" | "c") => (a === "r" ? "right" : a === "c" ? "center" : a === "l" ? "left" : "justify");

function Block({ b }: { b: DocBlock }) {
  switch (b.k) {
    case "title": return <Text style={t.title}>{b.t}</Text>;
    case "center": return <Text style={t.center} minPresenceAhead={40}>{b.t}</Text>;
    case "h": return <Text style={t.h} minPresenceAhead={50}><Runs runs={b.r} bold /></Text>;
    case "p": return <Text style={[t.p, { textAlign: align(b.align) }]}><Runs runs={b.r} /></Text>;
    case "li": return (
      <View style={t.liRow} wrap={false}>
        <Text style={t.liMark}>{b.mark}</Text>
        <Text style={{ flex: 1, textAlign: "justify" }}><Runs runs={b.r} /></Text>
      </View>
    );
    case "sign": return (
      <View style={t.signRow} wrap={false}>
        {b.cols.map((c, i) => (
          <View key={i} style={t.signCol}>
            {c.lines.map((l, j) => <Text key={j} style={{ marginBottom: 3, marginTop: l.startsWith("___") ? 36 : 0, fontFamily: j === 0 ? "Times-Bold" : "Times-Roman" }}>{l}</Text>)}
          </View>
        ))}
      </View>
    );
    case "space": return <View style={{ height: b.h ?? 8 }} />;
  }
}

export function TextDocPdf({ doc }: { doc: TextDoc }) {
  return (
    <Document title={doc.title} author="311 Consultores">
      <Page size="LEGAL" style={t.page}>
        <Text style={t.title}>{doc.title}</Text>
        {doc.blocks.map((b, i) => <Block key={i} b={b} />)}
      </Page>
    </Document>
  );
}

// ---------- Recibo de pago: diseño de 311 Consultores (hoja carta) ----------
const INK = "#2b2f35";
const DARK = "#33373d";
const r = StyleSheet.create({
  page: { backgroundColor: "#f8f9fb", fontFamily: "Helvetica", color: INK, fontSize: 10.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  rightCol: { position: "absolute", right: 82, top: 128, alignItems: "flex-end" },
  label: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  dots: { flexDirection: "row" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DARK, marginRight: 5 },
  th: { fontFamily: "Helvetica-Bold" },
  rule: { height: 0.7, backgroundColor: DARK },
});

const Dots = () => (
  <View style={r.dots}>
    <View style={r.dot} /><View style={r.dot} /><View style={r.dot} />
  </View>
);

export function ReciboPdf({ v, logo, firma }: { v: ReciboView; logo: Img; firma: Img }) {
  return (
    <Document title={`Recibo de pago ${v.folio}`} author="311 Consultores">
      <Page size="LETTER" style={r.page}>
        {/* Píldora con el logo */}
        <View style={{ position: "absolute", left: 371, top: 56, width: 241, height: 49, backgroundColor: "#e6e9ed", borderTopLeftRadius: 25, borderBottomLeftRadius: 25, alignItems: "center", justifyContent: "center" }}>
          {logo ? <Image src={logo} style={{ maxHeight: 30, maxWidth: 180, objectFit: "contain" }} /> : <Text style={{ fontFamily: "Helvetica-Bold", letterSpacing: 1.2 }}>311 CONSULTORES</Text>}
        </View>

        {/* Título vertical con su línea */}
        <View style={{ position: "absolute", left: 199, top: 0, width: 2.6, height: 146, backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: 192.5, top: 138, width: 15.6, height: 15.6, borderRadius: 8, backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: -44, top: 182, width: 380, height: 50, transform: "rotate(-90deg)", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 40, textAlign: "right" }}>Recibo de pago.</Text>
        </View>

        {/* Folio y fecha */}
        <View style={r.rightCol}>
          <Text style={r.label}>RECIBO:</Text>
          <Text style={{ marginBottom: 22 }}>{v.folio}</Text>
          <Text style={r.label}>FECHA:</Text>
          <Text style={{ marginBottom: 22 }}>{dateReceipt(v.fecha)}</Text>
          <Dots />
        </View>

        {/* Cliente */}
        <View style={{ position: "absolute", left: 82, top: 394, width: 130 }}>
          <Text style={[r.label, { marginBottom: 7 }]}>Cliente:</Text>
          {v.clienteNombre ? <Text style={{ marginBottom: 5 }}>{v.clienteNombre}</Text> : null}
          <Text>{v.clienteEmpresa}</Text>
        </View>
        <View style={{ position: "absolute", left: 92, top: 536 }}><Dots /></View>

        {/* Conceptos */}
        <View style={{ position: "absolute", left: 231, top: 317, width: 299 }}>
          <View style={r.rule} />
          <View style={{ flexDirection: "row", paddingVertical: 11 }}>
            <Text style={[r.th, { width: 37 }]}>No</Text>
            <Text style={[r.th, { flex: 1 }]}>Descripción</Text>
            <Text style={[r.th, { width: 88 }]}>Total</Text>
          </View>
          {v.conceptos.map((c, i) => (
            <View key={i} style={{ flexDirection: "row", paddingBottom: 12 }} wrap={false}>
              <Text style={{ width: 37 }}>{i + 1}.</Text>
              <Text style={{ flex: 1, paddingRight: 12 }}>{c.desc}</Text>
              <Text style={{ width: 88 }}>{moneyShort(c.cents)} MXN</Text>
            </View>
          ))}
          <View style={[r.rule, { marginTop: 4 }]} />
          <View style={{ flexDirection: "row", paddingTop: 13 }}>
            <Text style={[r.th, { flex: 1 }]}>Total</Text>
            <Text style={{ width: 88 }}>{moneyShort(v.total)} MXN</Text>
          </View>

          <View style={{ marginTop: 34 }} wrap={false}>
            <Text style={r.th}>Confirma de recibido:</Text>
            <View style={{ height: 22 }} />
            <Text>{v.recibe}</Text>
            {firma ? <Image src={firma} style={{ position: "absolute", left: 40, top: -22, width: 90, height: 72, objectFit: "contain" }} /> : null}
          </View>
        </View>

        {/* Franja inferior */}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 81, backgroundColor: DARK }} />
      </Page>
    </Document>
  );
}
