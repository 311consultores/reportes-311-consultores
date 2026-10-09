import { PrismaClient } from "@prisma/client";
import { cleanDatabaseUrl } from "@/lib/db-url";

// El motor de Prisma crea un hilo por cada núcleo del servidor. En hosting compartido (CloudLinux) los hilos
// cuentan como procesos del plan, así que se limitan. Debe definirse antes de crear el cliente.
process.env.TOKIO_WORKER_THREADS ??= "2";

type G = typeof globalThis & { __prisma?: PrismaClient; __prismaCreated?: number };
const g = globalThis as G;

const url = cleanDatabaseUrl(process.env.DATABASE_URL);

function create() {
  g.__prismaCreated = (g.__prismaCreated ?? 0) + 1;
  return new PrismaClient(url ? { datasourceUrl: url } : undefined);
}

/** Una sola instancia por proceso (también en producción) para no duplicar motores ni conexiones. */
export const prisma = (g.__prisma ??= create());

export const prismaInstances = () => g.__prismaCreated ?? 0;
