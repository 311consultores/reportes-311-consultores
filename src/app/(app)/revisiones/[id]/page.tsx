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

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { id } = await params;
  const focus = String((await searchParams).slide ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await prisma.review.findFirst({
    where: { id, ...reviewScope(user) },
    include: {
      client: { select: { id: true, companyName: true, logoUrl: true } },
      project: { select: { projectName: true } },
      slides: {
        orderBy: { position: "asc" },
        include: {
          assets: { orderBy: [{ version: "asc" }, { position: "asc" }] },
          copyVersions: { orderBy: { version: "desc" }, take: 1 },
          comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
        },
      },
    },
  });
  if (!r) notFound();

  const data: ReviewData = {
    id: r.id, title: r.title, status: r.status, round: r.round, startedAt: r.startedAt?.toISOString() ?? null,
    respondBy: r.respondBy ? isoDate(r.respondBy) : null, clientId: r.client.id, clientName: r.client.companyName, clientHasLogo: !!r.client.logoUrl, projectName: r.project.projectName,
    approvedByName: r.approvedByName, approvedAt: r.approvedAt?.toISOString() ?? null, copyUserId: r.copyUserId, artUserId: r.artUserId, notifyEmails: r.notifyEmails,
    slides: r.slides.map((s) => ({
      id: s.id, position: s.position, channel: s.channel, publishOn: s.publishOn ? isoDate(s.publishOn) : null, copy: s.copy, status: s.status,
      approvedByName: s.approvedByName, approvedAt: s.approvedAt?.toISOString() ?? null, reopenedReason: s.reopenedReason,
      copyVersion: s.copyVersion, prevCopy: s.copyVersions[0]?.text ?? null, artVersion: s.artVersion,
      assets: s.assets.filter((a) => a.version === s.artVersion).map((a) => ({ id: a.id, type: a.type, name: a.name })),
      prevAssets: s.assets.filter((a) => a.version === s.artVersion - 1).map((a) => ({ id: a.id, type: a.type, name: a.name })),
      pendingAssets: user.role === "CLIENTE" ? [] : s.assets.filter((a) => a.version > s.artVersion).map((a) => ({ id: a.id, type: a.type, name: a.name })),
      // El cliente solo ve sus comentarios y los ya enviados (nunca borradores de otra persona)
      comments: s.comments
        .filter((c) => user.role !== "CLIENTE" ? c.sentAt !== null : c.sentAt !== null || c.authorId === user.id)
        .map((c) => ({
          id: c.id, target: c.target, round: c.round, authorId: c.authorId, authorName: c.author.name, body: c.body, imageNo: c.imageNo, videoSec: c.videoSec,
          sentAt: c.sentAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(), resolvedAt: c.resolvedAt?.toISOString() ?? null, resolvedNote: c.resolvedNote,
        })),
    })),
  };

  if (user.role === "CLIENTE") return <ReviewViewer data={data} meId={user.id} />;

  const team = await prisma.user.findMany({ where: { role: "TEAM_311", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/revisiones" className="btn-outline inline-flex"><ArrowLeft size={16} /> Revisiones</Link>
      {r.status === "BORRADOR" ? <ReviewBuilder data={data} team={team} /> : <ReviewMonitor data={data} team={team} focusSlide={focus} />}
    </div>
  );
}
