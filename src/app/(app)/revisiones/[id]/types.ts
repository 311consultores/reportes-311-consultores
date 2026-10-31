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
  resolvedAt: string | null;
  resolvedNote: string | null;
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
  copyVersion: number;
  prevCopy: string | null; // la versión anterior del copy (para comparar)
  artVersion: number;
  assets: AssetData[]; // arte actual (el que ve el cliente)
  prevAssets: AssetData[]; // arte de la versión anterior
  pendingAssets: AssetData[]; // arte nuevo que el equipo prepara y todavía no aplica (solo equipo)
  comments: CommentData[];
};

export type ReviewData = {
  id: string;
  title: string;
  status: ReviewStatus;
  round: number;
  startedAt: string | null;
  respondBy: string | null; // AAAA-MM-DD
  clientId: string;
  clientName: string;
  clientHasLogo: boolean;
  projectName: string;
  approvedByName: string | null;
  approvedAt: string | null;
  copyUserId: string | null;
  artUserId: string | null;
  notifyEmails: string;
  slides: SlideData[];
};
