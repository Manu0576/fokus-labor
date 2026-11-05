/* Fokus-Labor: Offline-Speicher und Erinnerungen. Bei Änderungen die Versionsnummer erhöhen. */
const CACHE = "fokuslabor-v5";
const FILES = ["./", "index.html", "config.js", "nuggets.js", "main.js", "parent.js", "push.js", "texts.js", "parent-texts.js", "manifest.webmanifest",
  "werkstaetten.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.endsWith("supabase.co")) return; // Daten immer live
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});

/* Erinnerung empfangen */
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Fokus-Labor", {
    body: d.body || "Zeit für dein Fokus-Labor!",
    icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    tag: d.tag || "fokuslabor", data: { url: d.url || "./" }
  }));
});
/* Tipp auf die Erinnerung öffnet die App */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus(); }
    return clients.openWindow(url);
  }));
});
