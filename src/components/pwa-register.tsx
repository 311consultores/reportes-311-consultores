"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Smartphone, X } from "lucide-react";
import { startInstallCapture, useInstall } from "@/lib/pwa-install";

const KEY = "pwa_banner_off";
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };
const dismissed = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const dismiss = () => { try { localStorage.setItem(KEY, "1"); } catch { /* sin almacenamiento */ } listeners.forEach((f) => f()); };

/** Registra el service worker (notificaciones y app instalable) y muestra el mensaje fijo para instalar la app en celulares y tabletas. */
export function PwaRegister() {
  useEffect(() => {
    startInstallCapture();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return <InstallBanner />;
}

function InstallBanner() {
  const inst = useInstall();
  const off = useSyncExternalStore(subscribe, dismissed, () => true);
  if (off || inst.standalone || !inst.mobile) return null;
  return (
    <div className="glass fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-black/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm shadow-[0_-8px_30px_rgb(0,0,0,0.12)] dark:border-white/10" role="region" aria-label="Instalar la app">
      <Smartphone size={20} className="shrink-0 text-[#007AFF]" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">📲 Instala la app del Portal 311 en tu celular para entrar más rápido</span>
        {inst.ios ? (
          <span className="block text-xs text-zinc-500">Toca el botón Compartir (el cuadro con la flecha ↑) y elige «Agregar a pantalla de inicio».</span>
        ) : !inst.canPrompt ? (
          <span className="block text-xs text-zinc-500">Abre el menú del navegador (⋮) y elige «Instalar aplicación» o «Agregar a pantalla de inicio».</span>
        ) : null}
      </p>
      {inst.canPrompt && <button type="button" className="btn shrink-0 px-4 py-1.5" onClick={() => void inst.prompt()}>Instalar</button>}
      <button type="button" aria-label="Cerrar este mensaje" onClick={dismiss} className="shrink-0 rounded-full p-1.5 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"><X size={16} /></button>
    </div>
  );
}
