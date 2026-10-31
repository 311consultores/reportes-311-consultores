import type { ReviewStatus, SlideStatus } from "@prisma/client";

export type AssetData = { id: string; type: string; name: string };

export type CommentData = {
  id: string;
  target: "COPY" | "ART";
  round: number;
  authorId: string;
  authorName: string;
  body: string;
  imageNo: number | null;
  videoSec: number | null;
  sentAt: string | null;
  createdAt: string;
};

export type SlideData = {
  id: string;
  position: number;
  channel: string;
  publishOn: string | null; // AAAA-MM-DD
  copy: string;
  status: SlideStatus;
  approvedByName: string | null;
  approvedAt: string | null;
  reopenedReason: string | null;
  assets: AssetData[];
  comments: CommentData[];
};

export type ReviewData = {
  id: string;
  title: string;
  status: ReviewStatus;
  round: number;
  startedAt: string | null;
  respondBy: string | null; // AAAA-MM-DD
  clientName: string;
  projectName: string;
  approvedByName: string | null;
  approvedAt: string | null;
  copyUserId: string | null;
  artUserId: string | null;
  notifyEmails: string;
  slides: SlideData[];
};
