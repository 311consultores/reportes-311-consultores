"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { saveMetaAccount, syncMetaAccounts } from "@/app/actions/meta";
import { ActionForm } from "@/components/action-form";
import { ROLE_LABEL } from "@/lib/roles";
import type { Role } from "@prisma/client";

type Account = { id: string; adAccountId: string; name: string; currency: string | null; clientId: string | null; active: boolean; userIds: string[]; lastSyncAt: string | null };

/** Cuentas publicitarias importadas de Meta: se liga cada una a un cliente del portal y se elige qué EDITOR / PROJECT 311 la ven (el Administrador ve todas). */
export function AccountsAdmin({ accounts, clients, people, connected }: { accounts: Account[]; clients: { id: string; name: string }[]; people: { id: string; name: string; role: Role }[]; connected: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, start] = useTransition();

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold tracking-tight">Cuentas publicitarias</h2>
          <p className="meta">Importa las cuentas que ve la conexión de Meta (se puede repetir cuando haya clientes nuevos).</p>
        </div>
        <button type="button" className="btn" disabled={busy || !connected} onClick={() => start(async () => { const r = await syncMetaAccounts(); setMsg(r?.error ? { ok: false, text: r.error } : { ok: true, text: r?.message ?? "Listo" }); })}>
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {busy ? "Importando…" : "Importar cuentas de Meta"}
        </button>
      </div>
      {msg && <p role="status" className={`rounded-xl px-4 py-2 text-sm ${msg.ok ? "bg-[#34C759]/12 text-[#1E7B3A] dark:text-[#6EE7A0]" : "bg-[#FF3B30]/10 text-[#D70015] dark:text-[#FF6A60]"}`}>{msg.text}</p>}

      <div className="space-y-3">
        {accounts.map((a) => (
          <ActionForm key={a.id} action={saveMetaAccount} submitLabel="Guardar" successMessage="Guardado" resetOnSuccess={false} className="space-y-3 rounded-2xl border border-black/5 p-4 dark:border-white/10">
            <input type="hidden" name="id" value={a.id} />
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto min-w-0">
                <p className="truncate font-semibold">{a.name}</p>
                <p className="meta text-xs">{a.adAccountId} · {a.currency ?? "—"}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={a.active} className="h-4 w-4 accent-[#007AFF]" /> Activa en el portal</label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Cliente del portal</label>
                <select name="clientId" className="input" defaultValue={a.clientId ?? ""}>
                  <option value="">— Sin ligar —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Quién la ve (además del ADMINISTRADOR)</label>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => (
                    <label key={p.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-sm dark:border-white/15">
                      <input type="checkbox" name="userIds" value={p.id} defaultChecked={a.userIds.includes(p.id)} className="h-4 w-4 accent-[#007AFF]" />
                      {p.name} <span className="text-xs text-zinc-500">{ROLE_LABEL[p.role]}</span>
                    </label>
                  ))}
                  {people.length === 0 && <span className="meta text-xs">Aún no hay usuarios EDITOR ni PROJECT 311.</span>}
                </div>
              </div>
            </div>
          </ActionForm>
        ))}
        {accounts.length === 0 && <p className="meta">Todavía no hay cuentas importadas. Presiona «Importar cuentas de Meta».</p>}
      </div>
    </section>
  );
}
