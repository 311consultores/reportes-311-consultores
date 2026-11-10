"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { payPayrollWeek, savePayConfig, voidPayrollWeek } from "@/app/actions/payroll";
import { useDialogs } from "@/components/dialogs";
import { PaySplitModal, type BalanceMap } from "@/components/pay-split-modal";
import { fmtDate, formatCents, parseMoney } from "@/lib/finance";
import type { BreakdownRow } from "@/lib/payroll";
import { cn } from "@/lib/utils";

export type PayWeekRow = {
  id: string; year: number; week: number; payDate: string; status: "PROGRAMADA" | "PAGADA"; baseCents: number; breakdown: BreakdownRow[];
  adjustmentCents: number; adjustmentNote: string | null; paidCents: number | null; paidAt: string | null; voidReason: string | null;
};
export type PayConfigRow = { userId: string; name: string; amount: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Sueldos semanales acordados: se pueden cargar de un clic en quienes aún no tienen monto (se empata por el primer nombre). */
const SUGGESTED: Record<string, string> = { michelle: "2300", hafid: "2300", leslie: "1500", johnny: "3500", jesus: "3500", omar: "2000" };

const dayLabel = (iso: string) => fmtDate(new Date(`${iso}T00:00:00Z`));

/** Pagos de nómina por semana del año + configuración de los sueldos semanales. */
export function PayrollClient({ rows, config, today, balances }: { rows: PayWeekRow[]; config: PayConfigRow[]; today: string; balances: BalanceMap }) {
  const router = useRouter();
  const { askReason } = useDialogs();
  const [paying, setPaying] = useState<PayWeekRow | null>(null);
  const [error, setError] = useState<string>();
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(config.map((c) => [c.userId, c.amount])));
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [showConfig, setShowConfig] = useState(!rows.some((r) => r.baseCents > 0));

  const weeklyTotal = config.reduce((s, c) => s + (parseMoney(amounts[c.userId] ?? "") ?? 0), 0);

  async function voidWeek(w: PayWeekRow) {
    const why = await askReason({ title: `Anular el pago de la semana ${w.week}`, message: "El dinero regresa a la caja Nómina y la semana vuelve a PROGRAMADA.", reasonLabel: "Motivo de la anulación", confirmLabel: "Anular pago", danger: true });
    if (why === null) return;
    setError(undefined);
    const r = await voidPayrollWeek(w.id, why);
    if (r.error) setError(r.error);
    else router.refresh();
  }
  function suggest() {
    setAmounts((a) => {
      const next = { ...a };
      for (const c of config) {
        const first = norm(c.name).split(/\s+/)[0];
        if (!next[c.userId]?.trim() && SUGGESTED[first]) next[c.userId] = SUGGESTED[first];
      }
      return next;
    });
  }
  function save() {
    setMsg(undefined);
    startSave(async () => {
      const r = await savePayConfig(config.map((c) => ({ userId: c.userId, amount: amounts[c.userId] ?? "" })));
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Sueldos guardados. Las semanas PROGRAMADAS se actualizan; las pagadas no cambian." });
      if (!r.error) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Pagos de nómina por semana</h2>
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setShowConfig((v) => !v)}>{showConfig ? "Ocultar sueldos" : "Sueldos semanales"}</button>
        </div>
        <p className="meta">Se paga a más tardar el sábado, de la caja Nómina (efectivo y/o banco). Cada semana queda PROGRAMADA hasta que la marques como PAGADA.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {rows.length === 0 && <p className="card meta">Aún no hay semanas.</p>}
        <ul className="space-y-3">
          {rows.map((w) => {
            const late = w.status === "PROGRAMADA" && w.payDate < today;
            const thisWeek = w.status === "PROGRAMADA" && w.payDate >= today && w.payDate <= new Date(new Date(`${today}T00:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
            return (
              <li key={w.id} className="card space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Semana {w.week} · {w.year}</p>
                    <p className="meta text-xs">Pago a más tardar el sábado {dayLabel(w.payDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{formatCents(w.paidCents ?? w.baseCents)}</p>
                    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", w.status === "PAGADA" ? "bg-[#34C759]/15 text-[#1E7B3A] dark:text-[#6EE7A0]" : late ? "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF453A]" : "bg-[#FF9500]/15 text-[#B25E00] dark:text-[#FFB340]")}>
                      {w.status === "PAGADA" ? "PAGADA" : late ? "PROGRAMADA · atrasada" : thisWeek ? "PROGRAMADA · esta semana" : "PROGRAMADA"}
                    </span>
                  </div>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-[#007AFF]">Ver desglose por persona</summary>
                  <ul className="mt-2 divide-y divide-black/5 rounded-xl border border-black/5 dark:divide-white/10 dark:border-white/10">
                    {w.breakdown.map((r) => <li key={r.userId} className="flex justify-between px-3 py-1.5"><span>{r.name}</span><span>{formatCents(r.cents)}</span></li>)}
                    {w.breakdown.length === 0 && <li className="px-3 py-1.5 text-zinc-500">Sin sueldos configurados.</li>}
                  </ul>
                </details>
                {w.status === "PAGADA" && (
                  <p className="meta text-xs">
                    Pagada el {w.paidAt ? new Date(w.paidAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" }) : ""}
                    {w.adjustmentCents !== 0 ? ` · Ajuste ${w.adjustmentCents > 0 ? "+" : ""}${formatCents(w.adjustmentCents)} (${w.adjustmentNote})` : ""}
                  </p>
                )}
                {w.status === "PROGRAMADA" && w.voidReason && <p className="meta text-xs">Pago anulado antes: {w.voidReason}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {w.status === "PROGRAMADA" && <button type="button" className="btn px-3 py-1.5 text-xs" disabled={w.baseCents <= 0} onClick={() => setPaying(w)}>Marcar como PAGADA</button>}
                  {w.status === "PAGADA" && <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => voidWeek(w)}>Anular pago</button>}
                  {w.status === "PROGRAMADA" && w.baseCents <= 0 && <span className="text-xs text-zinc-500">Primero configura los sueldos semanales.</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {showConfig && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Sueldos semanales</h2>
          <p className="meta">Lo que se paga cada semana a cada persona. También se edita en su perfil (Usuarios). Un cambio aplica a las semanas que sigan PROGRAMADAS; las ya pagadas conservan su desglose.</p>
          <ul className="divide-y divide-black/5 rounded-xl border border-black/5 dark:divide-white/10 dark:border-white/10">
            {config.map((c) => (
              <li key={c.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-sm">{c.name}</span>
                <input className="input !w-32 text-right" inputMode="decimal" placeholder="Sin sueldo" aria-label={`Sueldo semanal de ${c.name}`} value={amounts[c.userId] ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [c.userId]: e.target.value }))} />
              </li>
            ))}
          </ul>
          <p className="text-sm">Total semanal: <strong>{formatCents(weeklyTotal)}</strong></p>
          {msg && <p className={cn("text-sm", msg.ok ? "text-[#248A3D]" : "text-destructive")}>{msg.text}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar sueldos"}</button>
            <button type="button" className="btn-outline" onClick={suggest}>Cargar los montos acordados (Michelle, Hafid, Leslie, Johnny, Jesús y Omar)</button>
          </div>
        </section>
      )}

      {paying && (
        <PaySplitModal
          open onClose={() => setPaying(null)} title={`Pagar nómina · semana ${paying.week}`} subtitle={`Sábado ${dayLabel(paying.payDate)}`}
          totalCents={paying.baseCents} fixedBox="NOMINA" adjustable balances={balances} confirmLabel="Registrar pago de nómina"
          onPay={async (v) => { const r = await payPayrollWeek(paying.id, { cash: v.cash, bank: v.bank, adjustment: v.adjustment, note: v.note }); if (!r.error) router.refresh(); return r; }}
        />
      )}
    </div>
  );
}
