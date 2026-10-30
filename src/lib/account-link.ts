import { prisma } from "@/lib/prisma";

/** Cuenta con la que se puede cambiar (null si no hay vínculo válido). El vínculo solo vale si una de las dos cuentas es ADMINISTRADOR. */
export async function getLinkedAccount(userId: string, role: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { linkedUserId: true } });
  if (!me?.linkedUserId) return null;
  const other = await prisma.user.findUnique({ where: { id: me.linkedUserId }, select: { id: true, name: true, role: true, active: true, linkedUserId: true } });
  if (!other || !other.active || other.linkedUserId !== userId) return null;
  if (role !== "ADMIN" && other.role !== "ADMIN") return null;
  return { id: other.id, name: other.name, role: other.role };
}
