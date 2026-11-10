import type { InvoiceKind } from "@prisma/client";

/** Archivos que se pueden adjuntar a cada tipo de documento y lo que se acepta en cada uno. */
export type FileSlot = "PDF" | "XML" | "COMPROBANTE";

export const MAX_INVOICE_FILE = 10 * 1024 * 1024; // 10 MB

export const SLOT_INFO: Record<FileSlot, { label: string; accept: string; mimes: Record<string, string> }> = {
  PDF: { label: "Factura en PDF", accept: "application/pdf", mimes: { "application/pdf": "pdf" } },
  XML: { label: "Factura en XML", accept: ".xml,text/xml,application/xml", mimes: { "text/xml": "xml", "application/xml": "xml" } },
  COMPROBANTE: { label: "Comprobante", accept: "application/pdf,image/jpeg,image/png", mimes: { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } },
};

export const SLOTS_BY_KIND: Record<InvoiceKind, FileSlot[]> = { FACTURA: ["PDF", "XML"], RECIBO: ["COMPROBANTE"] };

export const isSlot = (v: unknown): v is FileSlot => v === "PDF" || v === "XML" || v === "COMPROBANTE";

/** Verifica el contenido real del archivo, no solo el tipo declarado. */
export function matchesSignature(slot: FileSlot, mime: string, b: Buffer): boolean {
  if (mime === "application/pdf") return b.subarray(0, 4).toString() === "%PDF";
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/png") return b.subarray(1, 4).toString() === "PNG";
  if (slot === "XML") return b.subarray(0, 200).toString("utf8").replace(/^﻿/, "").trimStart().startsWith("<");
  return false;
}

/** Nombre sugerido al descargar: «Factura A-2026-014.pdf». */
export function downloadName(kind: InvoiceKind, number: string | null, slot: string, ext: string): string {
  const base = kind === "FACTURA" ? "Factura" : "Recibo";
  const tag = slot === "XML" ? "" : "";
  const num = (number ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim();
  return `${base}${num ? ` ${num}` : ""}${tag}.${ext}`;
}
