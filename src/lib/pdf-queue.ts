import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { buildReportPdf } from "@/lib/pdf";
import { getLogo311Key } from "@/lib/branding";
import { pdfStats } from "@/lib/pdf-stats";

/**
 * Generar un PDF es lo más pesado que hace el sistema (CPU y memoria). Para no saturar el servidor:
 *  - solo se genera uno a la vez (los demás esperan en cola);
 *  - si el reporte no cambió, se devuelve el PDF ya generado (caché en memoria);
 *  - varias peticiones del mismo reporte comparten una sola generación.
 */
const MAX_CONCURRENT = 1;
const CACHE_MAX_ITEMS = 25;
const CACHE_MAX_BYTES = 30 * 1024 * 1024;

type Pdf = { buffer: Buffer; folio: string };
type Entry = Pdf & { fingerprint: string };

const cache = new Map<string, Entry>(); // el orden de inserción hace de LRU
let cacheBytes = 0;
let active = 0;
const waiters: Array<() => void> = [];
const inflight = new Map<string, Promise<Pdf>>();

async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve)); // el turno se hereda en release()
}

function release() {
  const next = waiters.shift();
  if (next) next();
  else active--;
}

function remember(id: string, e: Entry) {
  const old = cache.get(id);
  if (old) {
    cacheBytes -= old.buffer.length;
    cache.delete(id);
  }
  cache.set(id, e);
  cacheBytes += e.buffer.length;
  while (cache.size > CACHE_MAX_ITEMS || cacheBytes > CACHE_MAX_BYTES) {
    const [oldestId, oldest] = cache.entries().next().value as [string, Entry];
    cacheBytes -= oldest.buffer.length;
    cache.delete(oldestId);
  }
}

/** Huella de todo lo que influye en el PDF: si no cambia, el PDF tampoco. */
async function fingerprint(reportId: string): Promise<string | null> {
  const r = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      updatedAt: true,
      client: { select: { companyName: true, logoUrl: true } },
      project: { select: { projectName: true } },
      tasks: { select: { id: true, updatedAt: true, evidences: { select: { id: true } } } },
    },
  });
  if (!r) return null;
  const logo311 = await getLogo311Key();
  const raw = JSON.stringify([
    r.updatedAt, r.client, r.project, logo311,
    r.tasks.map((t) => [t.id, t.updatedAt, t.evidences.map((e) => e.id)]),
  ]);
  return createHash("sha1").update(raw).digest("hex");
}

export async function getReportPdf(reportId: string): Promise<Pdf> {
  const fp = await fingerprint(reportId);
  if (!fp) throw new Error("Reporte no encontrado");

  const hit = cache.get(reportId);
  if (hit && hit.fingerprint === fp) {
    pdfStats.cacheHits++;
    remember(reportId, hit); // lo marca como el más reciente
    return { buffer: hit.buffer, folio: hit.folio };
  }

  const key = `${reportId}:${fp}`;
  const running = inflight.get(key);
  if (running) return running;

  const job = (async () => {
    pdfStats.enCola++;
    await acquire();
    pdfStats.enCola--;
    pdfStats.activos++;
    try {
      const pdf = await buildReportPdf(reportId);
      pdfStats.generados++;
      remember(reportId, { ...pdf, fingerprint: fp });
      return pdf;
    } finally {
      pdfStats.activos--;
      release();
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}
