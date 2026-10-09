import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pdfStats } from "@/lib/pdf-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Err = { name?: string; code?: string; errorCode?: string; message?: string };
const clean = (s: string) => s.replace(/:\/\/\S*@/g, "://***@").replace(/\s+/g, " ").slice(0, 600);
const describe = (e: unknown) => {
  const err = e as Err;
  return { name: err.name, code: err.code ?? err.errorCode, message: clean(err.message ?? String(e)) };
};

/**
 * Diagnóstico de la instalación. Sin parámetros solo devuelve ok/error y datos no sensibles.
 * Con ?token=<HEALTH_TOKEN> agrega el detalle del error (sin credenciales).
 * Prisma se carga dentro del try para poder reportar fallos del motor de la base de datos.
 */
/** Hilos, memoria y descriptores abiertos de este proceso (hilos y descriptores solo en Linux). */
function resources() {
  const mem = process.memoryUsage();
  const mb = (n: number) => Math.round(n / 1048576);
  let threads: number | null = null;
  let fds: number | null = null;
  try {
    threads = Number(/Threads:\s+(\d+)/.exec(fs.readFileSync("/proc/self/status", "utf8"))?.[1]) || null;
    fds = fs.readdirSync("/proc/self/fd").length;
  } catch {
    /* no es Linux */
  }
  return {
    pid: process.pid,
    ppid: process.ppid,
    nucleosDelServidor: os.availableParallelism?.() ?? os.cpus().length,
    uptimeMin: Math.round(process.uptime() / 60),
    rssMB: mb(mem.rss),
    heapMB: mb(mem.heapUsed),
    hilos: threads,
    descriptoresAbiertos: fds,
    instanciasPrisma: (globalThis as { __prismaCreated?: number }).__prismaCreated ?? 0,
    pdf: pdfStats,
    tokioWorkerThreads: process.env.TOKIO_WORKER_THREADS ?? null,
  };
}

export async function GET(req: Request) {
  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    AUTH_SECRET: (process.env.AUTH_SECRET?.length ?? 0) >= 16,
    GMAIL: !!(
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.GMAIL_SENDER
    ),
    UPLOADS_DIR_o_S3: !!(process.env.UPLOADS_DIR || process.env.S3_BUCKET),
    MAIL_DRY_RUN: process.env.MAIL_DRY_RUN === "true",
  };

  // Datos del servidor útiles para elegir el motor de Prisma correcto
  const token = new URL(req.url).searchParams.get("token");
  const allowed = !!process.env.HEALTH_TOKEN && token === process.env.HEALTH_TOKEN;

  // getReport() es costoso: solo se usa con el token (diagnóstico manual), nunca en revisiones automáticas
  const report = allowed
    ? (process.report?.getReport?.() as { header?: { glibcVersionRuntime?: string } } | undefined)
    : undefined;
  const server = {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    openssl: process.versions.openssl,
    ...(allowed ? { glibc: report?.header?.glibcVersionRuntime } : {}),
    prismaEngineEnv: !!process.env.PRISMA_QUERY_ENGINE_LIBRARY,
  };
  let engines: string[] = [];
  try {
    engines = fs
      .readdirSync(path.join(process.cwd(), "node_modules", ".prisma", "client"))
      .filter((f) => /query_engine/.test(f));
  } catch {
    engines = ["(no se pudo leer node_modules/.prisma/client)"];
  }

  let db: "ok" | "error" = "ok";
  let detail: ReturnType<typeof describe> | undefined;
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    await prisma.user.count();
  } catch (e) {
    db = "error";
    detail = describe(e);
  }

  const ok = db === "ok" && env.DATABASE_URL && env.AUTH_SECRET;

  return Response.json(
    {
      ok,
      server,
      engines,
      env,
      db,
      ...(allowed && detail ? { detail } : {}),
      // Consumo de recursos del proceso (solo con token): sirve para detectar fugas o picos
      ...(allowed ? { recursos: resources() } : {}),
    },
    { status: ok ? 200 : 503 },
  );
}
