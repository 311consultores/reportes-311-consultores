"use client";

import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { getPushMuted, sendTestPush, setPushMuted } from "@/app/actions/push";
import { useInstall } from "@/lib/pwa-install";
import { PUSH_GROUPS } from "@/lib/push-kinds";
import { usePush } from "@/lib/use-push";
import { cn } from "@/lib/utils";

/** Instalar la app y administrar las notificaciones del navegador de este dispositivo. */
export function AppPanel({ isOps }: { isOps: boolean }) {
  const inst = useInstall();
  const push = usePush();
  const [muted, setMuted] = useState<string[]>([]);
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    if (push.endpoint) void getPushMuted(push.endpoint).then(setMuted);
  }, [push.endpoint]);

  async function toggleGroup(kinds: string[], on: boolean) {
    if (!push.endpoint) return;
    const next = on ? muted.filter((k) => !kinds.includes(k)) : [...new Set([...muted, ...kinds])];
    setMuted(next);
    await setPushMuted(push.endpoint, next);
  }

  return (
    <>
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Smartphone size={18} /> Instalar la app</h2>
        {inst.standalone ? (
          <p className="text-sm text-[#248A3D] dark:text-[#30D158]">✅ Ya estás usando la app instalada.</p>
        ) : (
          <>
            <p className="meta">Instala el Portal 311 en tu celular, tableta o computadora: se abre en pantalla completa, con su ícono, y entras más rápido.</p>
            {inst.canPrompt && <button type="button" className="btn" onClick={() => void inst.prompt()}>Instalar la app</button>}
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li><strong>Android (Chrome):</strong> usa el botón «Instalar la app» de arriba, o abre el menú ⋮ y elige «Instalar aplicación».</li>
              <li><strong>iPhone o iPad (Safari):</strong> toca el botón Compartir (el cuadro con la flecha ↑) y elige «Agregar a pantalla de inicio».</li>
              <li><strong>Computadora (Chrome o Edge):</strong> haz clic en el ícono de instalar que aparece a la derecha de la barra de direcciones.</li>
            </ul>
          </>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><BellRing size={18} /> Notificaciones del navegador</h2>
        <p className="meta">Recibe un aviso en este dispositivo aunque no tengas el portal abierto. Cada dispositivo se activa por separado.</p>
        {!push.supported ? (
          <p className="text-sm text-[#B25E00] dark:text-[#FFB340]">
            Este navegador no permite notificaciones.{inst.ios ? " En iPhone o iPad primero instala la app (Compartir › Agregar a pantalla de inicio) y ábrela desde su ícono." : ""}
          </p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
              <input type="checkbox" className="h-5 w-5 accent-[#007AFF]" checked={push.subscribed} disabled={push.busy} onChange={(e) => (e.target.checked ? void push.enable() : void push.disable())} />
              {push.subscribed ? "Notificaciones activadas en este dispositivo" : "Activar notificaciones en este dispositivo"}
            </label>
            {push.permission === "denied" && <p className="text-sm text-destructive">El navegador tiene bloqueadas las notificaciones de este sitio. Permítelas en la configuración del sitio (el candado junto a la dirección) y vuelve a intentarlo.</p>}
            {push.error && <p className="text-sm text-destructive">{push.error}</p>}
          </>
        )}

        {push.subscribed && (
          <>
            <div className="space-y-2 border-t border-black/5 pt-4 dark:border-white/10">
              <h3 className="text-sm font-semibold">¿De qué quieres que te avisemos?</h3>
              {PUSH_GROUPS.filter((g) => isOps || !g.ops).map((g) => {
                const on = !g.kinds.some((k) => muted.includes(k));
                return (
                  <label key={g.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm", on ? "bg-[#007AFF]/[0.06]" : "bg-black/[0.03] dark:bg-white/[0.04]")}>
                    <input type="checkbox" className="h-4 w-4 accent-[#007AFF]" checked={on} onChange={(e) => void toggleGroup(g.kinds, e.target.checked)} />
                    {g.label}
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-outline" onClick={async () => { const r = await sendTestPush(); setMsg(r.error ?? "Te enviamos una notificación de prueba. Si no la ves, cambia a otra pestaña o minimiza el portal y vuelve a probar."); }}>Enviar notificación de prueba</button>
              {msg && <span className="text-xs text-zinc-500">{msg}</span>}
            </div>
          </>
        )}
      </section>
    </>
  );
}
