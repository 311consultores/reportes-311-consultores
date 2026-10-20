import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { noteInclude, toNoteCard } from "@/lib/notes";
import { TRASH_DAYS } from "@/lib/note-types";
import { BaulApp } from "./baul-app";

export const metadata = { title: "Baúl | Portal de Operaciones" };

const trashCutoff = () => new Date(Date.now() - TRASH_DAYS * 86_400_000);

export default async function BaulPage({ searchParams }: { searchParams: Promise<{ nota?: string }> }) {
  const me = await requireUser(["ADMIN", "EDITOR", "TEAM_311"]);
  const { nota } = await searchParams;
  const isOps = me.role !== "TEAM_311";

  // La papelera conserva 30 días: lo más viejo se borra al entrar
  await prisma.note.deleteMany({ where: { ownerId: me.id, trashedAt: { lt: trashCutoff() } } });

  const taskScope = isOps ? {} : { assignees: { some: { userId: me.id } } };
  const [own, shared, labels, clients, tasks, people] = await Promise.all([
    prisma.note.findMany({ where: { ownerId: me.id }, include: noteInclude, orderBy: [{ pinned: "desc" }, { position: "asc" }] }),
    prisma.note.findMany({ where: { shares: { some: { userId: me.id } }, trashedAt: null, ownerId: { not: me.id } }, include: noteInclude, orderBy: { updatedAt: "desc" } }),
    prisma.noteLabel.findMany({ where: { ownerId: me.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true, projects: { orderBy: { projectName: "asc" }, select: { id: true, projectName: true } } } }),
    prisma.task.findMany({ where: taskScope, orderBy: { updatedAt: "desc" }, take: 300, select: { id: true, title: true, client: { select: { companyName: true } } } }),
    prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "EDITOR", "TEAM_311"] }, id: { not: me.id } }, orderBy: { name: "asc" }, select: { id: true, name: true, photoUrl: true } }),
  ]);

  return (
    <BaulApp
      notes={[...own, ...shared].map((n) => toNoteCard(n, me.id))}
      labels={labels}
      clients={clients.map((c) => ({ id: c.id, name: c.companyName, projects: c.projects.map((p) => ({ id: p.id, name: p.projectName })) }))}
      tasks={tasks.map((t) => ({ id: t.id, title: t.title, client: t.client.companyName }))}
      people={people}
      isOps={isOps}
      openId={nota}
    />
  );
}
