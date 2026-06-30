/* err.day service worker — Web Push for admin/owner notifications. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { data = {}; }

  const title = data.title || "err.day";
  const options = {
    body:  data.body || "",
    icon:  "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag:   data.tag || undefined,
    data:  { url: data.url || "/admin/m" },
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/m";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if ("focus" in c) {
        try { await c.navigate(url); } catch (_e) { /* cross-origin or unsupported */ }
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
