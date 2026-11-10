import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serveStoredFile } from "@/lib/serve-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Comprobante de un reembolso: lo ve el ADMINISTRADOR y la persona que lo solicitó. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const r = await prisma.reimbursement.findFirst({ where: { id, ...(user.role === "ADMIN" ? {} : user.role === "TEAM_311" ? { requestedById: user.id } : { id: "-" }) } });
  if (!r) return new Response("No encontrado", { status: 404 });
  return serveStoredFile(req, r.receiptKey, {
    "Content-Type": r.receiptType,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(r.receiptName)}`,
    "Cache-Control": "private, no-store",
  });
}
