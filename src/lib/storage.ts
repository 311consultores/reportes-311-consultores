import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";

/**
 * Almacenamiento de evidencias. Con S3_BUCKET definido usa S3 / DigitalOcean Spaces;
 * si no, guarda en ./.uploads (solo desarrollo local).
 */
const bucket = process.env.S3_BUCKET;
// UPLOADS_DIR permite guardar fuera de la carpeta de la app (así un redeploy no borra las evidencias)
const LOCAL_ROOT = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), ".uploads"));

let client: S3Client | undefined;
function s3() {
  return (client ??= new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        }
      : undefined,
  }));
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const contentTypeFor = (key: string) =>
  CONTENT_TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

function localPath(key: string) {
  const p = path.resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Ruta inválida");
  return p;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (bucket) {
    await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const p = localPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

export async function getObject(key: string): Promise<Buffer> {
  if (bucket) {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return fs.readFile(localPath(key));
}

export const usesLocalStorage = () => !bucket;

/** Flujo de escritura a disco local (crea la carpeta si hace falta). */
export async function createLocalWriteStream(key: string) {
  const p = localPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  return createWriteStream(p);
}

/** Tamaño de un archivo local (null si no existe o si se usa S3). */
export async function localSize(key: string): Promise<number | null> {
  if (bucket) return null;
  try {
    return (await fs.stat(localPath(key))).size;
  } catch {
    return null;
  }
}

/** Flujo de lectura de un archivo local (con rango opcional), sin cargarlo completo en memoria. */
export function openLocalStream(key: string, range?: { start: number; end: number }) {
  return createReadStream(localPath(key), range);
}

export async function deleteObject(key: string) {
  if (bucket) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  await fs.rm(localPath(key), { force: true });
}

/** URL firmada temporal (S3) o null cuando el archivo se sirve desde disco local. */
export async function getDownloadUrl(key: string): Promise<string | null> {
  if (!bucket) return null;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}
