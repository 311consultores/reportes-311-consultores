import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getObject, putObject, deleteObject, contentTypeFor } from "@/lib/storage";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const SETTING_LOGO = "logo311";

export type LogoImage = { data: Buffer; format: "png" | "jpg"; contentType: string };

type Validated = { ok: true; buf: Buffer; ext: "png" | "jpg"; mime: string } | { ok: false; error: string };

/** Valida un logo subido: PNG o JPG, hasta 2 MB, comprobando el contenido real del archivo. */
export async function validateLogo(file: File): Promise<Validated> {
  if (file.size > LOGO_MAX_BYTES) return { ok: false, error: "El logo no debe pesar más de 2 MB" };
  const buf = Buffer.from(await file.arrayBuffer());
  const isPng = buf.length > 8 && buf.subarray(1, 4).toString() === "PNG";
  const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;
  if (!isPng && !isJpg) return { ok: false, error: "El logo debe ser una imagen PNG o JPG" };
  return isPng
    ? { ok: true, buf, ext: "png", mime: "image/png" }
    : { ok: true, buf, ext: "jpg", mime: "image/jpeg" };
}

/** Guarda un logo en el almacenamiento y devuelve su clave. */
export async function storeLogo(prefix: string, v: Extract<Validated, { ok: true }>): Promise<string> {
  const key = `branding/${prefix}-${randomUUID()}.${v.ext}`;
  await putObject(key, v.buf, v.mime);
  return key;
}

export async function readLogo(key: string | null | undefined): Promise<LogoImage | null> {
  if (!key) return null;
  try {
    const data = await getObject(key);
    return { data, format: key.endsWith(".png") ? "png" : "jpg", contentType: contentTypeFor(key) };
  } catch {
    return null;
  }
}

export async function getSetting(key: string): Promise<string | null> {
  return (await prisma.appSetting.findUnique({ where: { key } }))?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export const getLogo311Key = () => getSetting(SETTING_LOGO);
export const readLogo311 = async () => readLogo(await getLogo311Key());

/** Reemplaza el logo de 311 CONSULTORES y borra el anterior. */
export async function replaceLogo311(v: Extract<Validated, { ok: true }>) {
  const old = await getLogo311Key();
  const key = await storeLogo("311", v);
  await setSetting(SETTING_LOGO, key);
  if (old) await deleteObject(old).catch(() => {});
}

/** Reemplaza el logo de un cliente y borra el anterior. */
export async function replaceClientLogo(clientId: string, v: Extract<Validated, { ok: true }>) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { logoUrl: true } });
  const key = await storeLogo(`client-${clientId}`, v);
  await prisma.client.update({ where: { id: clientId }, data: { logoUrl: key } });
  if (client.logoUrl) await deleteObject(client.logoUrl).catch(() => {});
}
