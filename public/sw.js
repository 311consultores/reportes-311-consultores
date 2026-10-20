/* Service worker del Portal 311: notificaciones del navegador y requisito de la app instalable. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Requisito para poder instalar la app: el portal siempre se pide a la red (no se guarda nada sin conexión)
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Portal 311", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(
    (async () => {
      // Si la persona está viendo el portal en este momento, no se muestra (ya lo ve en la campanita)
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (wins.some((w) => w.visibilityState === "visible")) return;
      await self.registration.showNotification(data.title || "Portal 311", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag || undefined,
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if ("focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
