// Simple offline cache for Rootz
const CACHE = "rootz-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./puzzles.json",
  "./manifest.webmanifest",
  "./privacy.html",
  "./terms.html",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

// Tapping the daily reminder should focus an existing Rootz tab if any,
// otherwise open a fresh one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if (c.url.includes("/") && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow("./index.html");
    })
  );
});
