import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isoDate } from "@/lib/finance";
import { reviewScope } from "@/lib/reviews";
import { ReviewBuilder } from "./review-builder";
import { ReviewMonitor } from "./review-monitor";
import { ReviewViewer } from "./review-viewer";
import type { ReviewData } from "./types";

export const metadata = { title: "Revisión | Portal de Operaciones" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await prisma.review.findFirst({
    where: { id, ...reviewScope(user) },
    include: {
      client: { select: { companyName: true } },
      project: { select: { projectName: true } },
      slides: {
        orderBy: { position: "asc" },
        include: {
          assets: { orderBy: { position: "asc" } },
          comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
        },
      },
    },
  });
  if (!r) notFound();

  const data: ReviewData = {
    id: r.id, title: r.title, status: r.status, round: r.round, startedAt: r.startedAt?.toISOString() ?? null,
    respondBy: r.respondBy ? isoDate(r.respondBy) : null, clientName: r.client.companyName, projectName: r.project.projectName,
    approvedByName: r.approvedByName, approvedAt: r.approvedAt?.toISOString() ?? null, copyUserId: r.copyUserId, artUserId: r.artUserId, notifyEmails: r.notifyEmails,
    slides: r.slides.map((s) => ({
      id: s.id, position: s.position, channel: s.channel, publishOn: s.publishOn ? isoDate(s.publishOn) : null, copy: s.copy, status: s.status,
      approvedByName: s.approvedByName, approvedAt: s.approvedAt?.toISOString() ?? null, reopenedReason: s.reopenedReason,
      assets: s.assets.map((a) => ({ id: a.id, type: a.type, name: a.name })),
      // El cliente solo ve sus comentarios y los ya enviados (nunca borradores de otra persona)
      comments: s.comments
        .filter((c) => user.role !== "CLIENTE" ? c.sentAt !== null : c.sentAt !== null || c.authorId === user.id)
        .map((c) => ({
          id: c.id, target: c.target, round: c.round, authorId: c.authorId, authorName: c.author.name, body: c.body, imageNo: c.imageNo, videoSec: c.videoSec,
          sentAt: c.sentAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(),
        })),
    })),
  };

  if (user.role === "CLIENTE") return <ReviewViewer data={data} meId={user.id} />;

  const team = await prisma.user.findMany({ where: { role: "TEAM_311", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/revisiones" className="btn-outline inline-flex"><ArrowLeft size={16} /> Revisiones</Link>
      {r.status === "BORRADOR" ? <ReviewBuilder data={data} team={team} /> : <ReviewMonitor data={data} team={team} />}
    </div>
  );
}
