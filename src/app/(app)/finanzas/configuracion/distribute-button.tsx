"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { distributePastPayments } from "@/app/actions/finance";
import { useDialogs } from "@/components/dialogs";

/** Reparte en las cajas los cobros que ya estaban pagados antes de existir esta función. */
export function DistributeButton({ count }: { count: number }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  async function click() {
    const ok = await confirm({
      title: "Repartir cobros anteriores",
      message: `Se repartirá en las cajas el cobro de ${count} documento(s) ya pagado(s), con los porcentajes de hoy, usando su fecha de cobro. Esto no se puede repetir para los mismos documentos.`,
      confirmLabel: "Repartir",
    });
    if (!ok) return;
    setMsg(undefined);
    start(async () => {
      const r = await distributePastPayments();
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: `Listo: se repartieron ${r.count} cobro(s)` });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn" disabled={busy} onClick={click}>{busy ? "Repartiendo…" : `Repartir ${count} cobro(s) anteriores`}</button>
      {msg && <span className={msg.ok ? "text-sm text-[#248A3D] dark:text-[#30D158]" : "text-sm text-destructive"}>{msg.text}</span>}
    </div>
  );
}
