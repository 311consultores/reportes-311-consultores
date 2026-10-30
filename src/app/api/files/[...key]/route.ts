import { isTaskManager } from "@/lib/roles";
import { publishedWhere } from "@/lib/task-visibility";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, reportScope } from "@/lib/auth";
import { serveStoredFile } from "@/lib/serve-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const params = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const key = params.key.join("/");
  const m = key.match(/^reports\/([0-9a-f-]{36})\/[\w.-]+$/);
  const tm = key.match(/^tareas\/([0-9a-f-]{36})\/[\w.-]+$/);
  if (!m && !tm) return new Response("No encontrado", { status: 404 });

  if (m) {
    const report = await prisma.report.findFirst({
      where: { id: m[1], ...reportScope(user) },
      select: { id: true },
    });
    if (!report) return new Response("No encontrado", { status: 404 });
  } else if (tm) {
    // Adjuntos del chat de una tarea: quien gestiona tareas, o la persona asignada
    const task = await prisma.task.findFirst({
      where: { id: tm[1], ...(isTaskManager(user.role) ? {} : user.role === "TEAM_311" ? { assignees: { some: { userId: user.id } }, ...publishedWhere() } : { id: "-" }) },
      select: { id: true },
    });
    if (!task) return new Response("No encontrado", { status: 404 });
  }

  return serveStoredFile(req, key);
}
