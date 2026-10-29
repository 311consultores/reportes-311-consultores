// Generador mínimo de archivos Word (.docx) sin dependencias: arma el zip y el XML a mano.
import { deflateRawSync } from "node:zlib";
import { dateReceipt, moneyShort, type DocBlock, type Run, type TextDoc } from "@/lib/docs/text";
import type { ReciboView } from "@/lib/docs/templates";

// ---------- Zip ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const comp = deflateRawSync(f.data);
    const crc = crc32(f.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); // hora y fecha fijas
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ---------- XML ----------
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const run = (r: Run, extra = "", force?: { b?: boolean }) =>
  `<w:r><w:rPr>${r.b || force?.b ? "<w:b/>" : ""}${r.i ? "<w:i/>" : ""}${extra}</w:rPr><w:t xml:space="preserve">${esc(r.t)}</w:t></w:r>`;

const JC = { j: "both", l: "left", r: "right", c: "center" } as const;

const para = (inner: string, o: { jc?: keyof typeof JC; after?: number; before?: number; ind?: string; keepNext?: boolean } = {}) =>
  `<w:p><w:pPr>${o.keepNext ? "<w:keepNext/>" : ""}<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 140}" w:line="276" w:lineRule="auto"/>${o.ind ?? ""}<w:jc w:val="${JC[o.jc ?? "j"]}"/></w:pPr>${inner}</w:p>`;

function blockXml(b: DocBlock): string {
  switch (b.k) {
    case "title": return para(run({ t: b.t, b: true }), { jc: "c", after: 240 });
    case "center": return para(run({ t: b.t, b: true }), { jc: "c", before: 120, keepNext: true });
    case "h": return para(b.r.map((r) => run(r, "", { b: true })).join(""), { jc: "l", before: 120, after: 100, keepNext: true });
    case "p": return para(b.r.map((r) => run(r)).join(""), { jc: b.align ?? "j" });
    case "li": return para(`${run({ t: b.mark })}<w:r><w:tab/></w:r>${b.r.map((r) => run(r)).join("")}`, { ind: '<w:ind w:left="720" w:hanging="360"/>', after: 100 });
    case "space": return para("", { after: (b.h ?? 8) * 20 });
    case "sign": {
      const w = Math.floor(9000 / b.cols.length);
      const cell = (lines: string[]) =>
        `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${lines.map((l, j) => para(run({ t: l, b: j === 0 }), { jc: "c", after: 60, before: l.startsWith("___") ? 720 : 0 })).join("")}</w:tc>`;
      return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${b.cols.map(() => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${b.cols.map((c) => cell(c.lines)).join("")}</w:tr></w:tbl>${para("", { after: 0 })}`;
    }
  }
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="es-MX"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

function pack(body: string, page: { w: number; h: number; top: number; side: number }): Buffer {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="${page.w}" w:h="${page.h}"/><w:pgMar w:top="${page.top}" w:right="${page.side}" w:bottom="${page.top}" w:left="${page.side}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    { name: "[Content_Types].xml", data: Buffer.from(CONTENT_TYPES) },
    { name: "_rels/.rels", data: Buffer.from(RELS) },
    { name: "word/document.xml", data: Buffer.from(doc) },
    { name: "word/styles.xml", data: Buffer.from(STYLES) },
    { name: "word/_rels/document.xml.rels", data: Buffer.from(DOC_RELS) },
  ]);
}

/** Contrato o acuerdo en Word (hoja oficio, Times New Roman 12). */
export function buildTextDocx(doc: TextDoc): Buffer {
  return pack(blockXml({ k: "title", t: doc.title }) + doc.blocks.map(blockXml).join(""), { w: 12240, h: 20160, top: 1417, side: 1640 });
}

/** Recibo de pago en Word: versión sencilla para editar (el diseño completo es el del PDF). */
export function buildReciboDocx(v: ReciboView): Buffer {
  const line = (label: string, value: string) => para(`${run({ t: label + " ", b: true })}${run({ t: value })}`, { jc: "l", after: 80 });
  const cell = (t: string, w: number, bold = false, jc: "l" | "r" = "l") => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${para(run({ t, b: bold }), { jc, after: 60, before: 60 })}</w:tc>`;
  const W = [700, 5600, 2000];
  const border = '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="33373D"/><w:bottom w:val="single" w:sz="6" w:color="33373D"/><w:insideH w:val="single" w:sz="4" w:color="BBBBBB"/></w:tblBorders>';
  const rows = [
    `<w:tr>${cell("No", W[0], true)}${cell("Descripción", W[1], true)}${cell("Total", W[2], true, "r")}</w:tr>`,
    ...v.conceptos.map((c, i) => `<w:tr>${cell(`${i + 1}.`, W[0])}${cell(c.desc, W[1])}${cell(`${moneyShort(c.cents)} MXN`, W[2], false, "r")}</w:tr>`),
    `<w:tr>${cell("", W[0])}${cell("Total", W[1], true)}${cell(`${moneyShort(v.total)} MXN`, W[2], true, "r")}</w:tr>`,
  ].join("");
  const body =
    para(run({ t: "Recibo de pago.", b: true }, '<w:sz w:val="56"/>'), { jc: "l", after: 200 }) +
    line("RECIBO:", v.folio) +
    line("FECHA:", dateReceipt(v.fecha)) +
    line("Cliente:", [v.clienteNombre, v.clienteEmpresa].filter(Boolean).join(" · ")) +
    para("", { after: 120 }) +
    `<w:tbl><w:tblPr><w:tblW w:w="8300" w:type="dxa"/>${border}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows}</w:tbl>` +
    para("", { after: 360 }) +
    line("Confirma de recibido:", v.recibe);
  return pack(body, { w: 12240, h: 15840, top: 1440, side: 1700 });
}
