/* Servus – Hintergrund-Helfer: Push-Nachrichten + Offline-Speicher */
const VERSION = "servus-v3";
const APP_DATEIEN = ["./", "index.html", "bereiche.js", "manifest.json", "icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(APP_DATEIEN.map(d => cache.add(d).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(namen.filter(n => n !== VERSION && n !== "servus-bilder").map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Erst Internet versuchen (damit Updates sofort da sind), bei schlechtem Netz den gespeicherten Stand nehmen
async function erstNetz(request, warten = 2500) {
  const cache = await caches.open(VERSION);
  const ausNetz = fetch(request).then(antwort => {
    if (antwort.ok) cache.put(request, antwort.clone());
    return antwort;
  });
  const gespeichert = await cache.match(request, { ignoreSearch: true })
    || (request.mode === "navigate" ? await cache.match("./") : undefined);
  if (!gespeichert) return ausNetz;
  const zeitAbgelaufen = new Promise(ok => setTimeout(() => ok(gespeichert), warten));
  return Promise.race([ausNetz.catch(() => gespeichert), zeitAbgelaufen]);
}

// Erst Speicher, sonst Internet (für Bibliotheken und Bilder, die sich nie ändern)
async function erstSpeicher(request, cacheName) {
  const cache = await caches.open(cacheName);
  const gespeichert = await cache.match(request);
  if (gespeichert) return gespeichert;
  const antwort = await fetch(request);
  if (antwort.ok || antwort.type === "opaque") cache.put(request, antwort.clone());
  return antwort;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(erstNetz(request));
  } else if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(erstSpeicher(request, VERSION));
  } else if (url.pathname.includes("/storage/v1/object/")) {
    event.respondWith(erstSpeicher(request, "servus-bilder"));
  }
});

/* ---------- Push-Nachrichten ---------- */
self.addEventListener("push", event => {
  const daten = event.data ? event.data.json() : {};
  const aufgaben = [
    self.registration.showNotification(daten.title || "Servus 🥨", { body: daten.body || "", icon: "icon.png", badge: "icon.png" })
  ];
  if (daten.badge && self.navigator.setAppBadge) aufgaben.push(self.navigator.setAppBadge(daten.badge));
  event.waitUntil(Promise.all(aufgaben));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(fenster => {
      const offen = fenster.find(f => "focus" in f);
      return offen ? offen.focus() : clients.openWindow("./");
    })
  );
});
