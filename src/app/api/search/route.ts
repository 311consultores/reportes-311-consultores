import { prisma } from "@/lib/prisma";
import { getCurrentUser, reportScope } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const strip = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Búsqueda de reportes: folio, cliente, proyecto y título o contenido de las actividades (máx. 8). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json([], { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json([]);

  const rows = await prisma.report.findMany({
    where: {
      ...reportScope(user),
      OR: [
        { folio: { contains: q } },
        { client: { companyName: { contains: q } } },
        { project: { projectName: { contains: q } } },
        { tasks: { some: { OR: [{ title: { contains: q } }, { descriptionHtml: { contains: q } }] } } },
      ],
    },
    include: {
      client: { select: { companyName: true } },
      project: { select: { projectName: true } },
      tasks: {
        where: { OR: [{ title: { contains: q } }, { descriptionHtml: { contains: q } }] },
        select: { sequentialNum: true, title: true, descriptionHtml: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return Response.json(
    rows.map((r) => {
      const t = r.tasks[0];
      let match: string | null = null;
      if (t) {
        const text = strip(t.descriptionHtml);
        const i = text.toLowerCase().indexOf(q.toLowerCase());
        const snippet = i >= 0 ? text.slice(Math.max(0, i - 25), i + 55) : text.slice(0, 80);
        match = `Actividad ${t.sequentialNum}${t.title ? ` — ${t.title}` : ""}: …${snippet}…`;
      }
      return { id: r.id, folio: r.folio, client: r.client.companyName, project: r.project.projectName, match };
    }),
  );
}
