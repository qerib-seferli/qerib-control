const CACHE = "q-control-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/config.js",
  "./js/supabase.js",
  "./js/core.js",
  "./js/api.js",
  "./js/app.js",
  "./manifest.json",
  "./offline.html",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Supabase və xarici API çağırışlarını cache etmə.
  if (url.hostname.includes("supabase.co") || url.hostname.includes("jsdelivr.net")) {
    event.respondWith(fetch(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match("./index.html")) || caches.match("./offline.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && url.origin === self.location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, clone));
      }
      return res;
    }))
  );
});
