"use client";

import { useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
let started = false;

/** Captura el aviso de «instalar» del navegador (Android/Chrome/Edge) para poder ofrecerlo con un botón propio. */
export function startInstallCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

export type InstallInfo = { canPrompt: boolean; standalone: boolean; ios: boolean; mobile: boolean; prompt: () => Promise<void> };

const snapshotKey = () => {
  if (typeof window === "undefined") return "ssr";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const mobile = window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1100;
  return [deferred ? 1 : 0, standalone ? 1 : 0, ios ? 1 : 0, mobile ? 1 : 0].join("");
};

/** Datos para el mensaje de instalación y la pantalla «App y avisos». */
export function useInstall(): InstallInfo {
  const key = useSyncExternalStore(subscribe, snapshotKey, () => "ssr");
  return {
    canPrompt: key[0] === "1",
    standalone: key[1] === "1",
    ios: key[2] === "1",
    mobile: key[3] === "1",
    prompt: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      notify();
    },
  };
}
