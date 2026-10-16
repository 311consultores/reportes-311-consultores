"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveEditRequest } from "@/app/actions/reports";

export function EditRequestActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (approve: boolean) =>
    start(async () => {
      const r = await resolveEditRequest(id, approve);
      setError(r.error);
      router.refresh();
    });
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button type="button" className="btn" disabled={busy} onClick={() => run(true)}>Aprobar (vuelve a En proceso)</button>
        <button type="button" className="btn-outline" disabled={busy} onClick={() => run(false)}>Rechazar</button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
