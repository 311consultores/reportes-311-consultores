// Genera el PDF y el Word de un documento guardado (solo servidor).
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocKind } from "@prisma/client";
import { readLogo, readLogo311 } from "@/lib/branding";
import { buildReciboDocx, buildTextDocx } from "@/lib/docs/docx";
import { ReciboPdf, TextDocPdf } from "@/lib/docs/pdf-render";
import { acuerdoDoc, reciboView } from "@/lib/docs/templates";
import { parseDocData } from "@/lib/docs/types";
import type { TextDoc } from "@/lib/docs/text";

type Row = { kind: DocKind; data: string; folio: string | null };

// Generar un PDF consume CPU y memoria: se hace uno a la vez.
let active = false;
const waiters: Array<() => void> = [];
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (active) await new Promise<void>((res) => waiters.push(res));
  active = true;
  try {
    return await fn();
  } finally {
    const next = waiters.shift();
    if (next) next(); // el turno pasa directo al siguiente
    else active = false;
  }
}

function textDocOf(row: Row): TextDoc {
  const d = parseDocData(row.data);
  if (d.kind === "ACUERDO") return acuerdoDoc(d);
  throw new Error("Este tipo de documento todavía no está disponible");
}

export async function renderPdf(row: Row): Promise<Buffer> {
  const d = parseDocData(row.data);
  if (d.kind === "RECIBO") {
    const [logo, firma] = await Promise.all([readLogo311(), d.firmaKey ? readLogo(d.firmaKey) : Promise.resolve(null)]);
    const view = reciboView(d, row.folio ?? "");
    return exclusive(() =>
      renderToBuffer(<ReciboPdf v={view} logo={logo && { data: logo.data, format: logo.format }} firma={firma && { data: firma.data, format: firma.format }} />),
    );
  }
  const doc = textDocOf(row);
  return exclusive(() => renderToBuffer(<TextDocPdf doc={doc} />));
}

export function renderDocx(row: Row): Buffer {
  const d = parseDocData(row.data);
  if (d.kind === "RECIBO") return buildReciboDocx(reciboView(d, row.folio ?? ""));
  return buildTextDocx(textDocOf(row));
}
