"use client";

import { useCallback, useEffect, useState } from "react";
import { getPushInfo, removePushSubscription, savePushSubscription } from "@/app/actions/push";

const b64ToUint8 = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export type PushState = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  endpoint: string | null;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

/** Estado y acciones de las notificaciones del navegador en este dispositivo. */
export function usePush(): PushState {
  const [state, setState] = useState<{ supported: boolean; permission: PushState["permission"]; endpoint: string | null; busy: boolean; error: string | null }>({
    supported: false, permission: "unsupported", endpoint: null, busy: false, error: null,
  });

  // Al abrir: ¿este dispositivo ya está suscrito? (y se vuelve a guardar por si cambió la persona que usa el dispositivo)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!ok) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setState((s) => ({ ...s, supported: true, permission: Notification.permission, endpoint: sub?.endpoint ?? null }));
      if (sub) void savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }, navigator.userAgent).catch(() => {});
    })().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const enable = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const info = await getPushInfo();
      if (!info.configured) throw new Error("Las notificaciones del navegador todavía no están configuradas en el servidor.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("El navegador no dio permiso. Revisa los permisos del sitio y vuelve a intentarlo.");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(info.publicKey) as BufferSource }));
      const r = await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }, navigator.userAgent);
      if (r.error) throw new Error(r.error);
      setState((s) => ({ ...s, permission: perm, endpoint: sub.endpoint, busy: false }));
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      const friendly = /permission|denied|not allowed|NotAllowed/i.test(m)
        ? "El navegador no permitió activar las notificaciones en este dispositivo. Revisa que el sitio tenga permitidas las notificaciones (el candado junto a la dirección) y que no estés en una ventana privada."
        : m || "No se pudieron activar las notificaciones";
      setState((s) => ({ ...s, busy: false, error: friendly }));
    }
  }, []);

  const disable = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState((s) => ({ ...s, endpoint: null, busy: false }));
    } catch (e) {
      setState((s) => ({ ...s, busy: false, error: e instanceof Error ? e.message : "No se pudieron desactivar" }));
    }
  }, []);

  return { ...state, subscribed: !!state.endpoint, enable, disable };
}
