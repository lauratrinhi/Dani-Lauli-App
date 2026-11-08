self.addEventListener("push", (event) => {
  const daten = event.data ? event.data.json() : {};
  const aufgaben = [
    self.registration.showNotification(daten.title || "Wir zwei 💕", { body: daten.body || "" })
  ];
  if (daten.badge && self.navigator.setAppBadge) aufgaben.push(self.navigator.setAppBadge(daten.badge));
  event.waitUntil(Promise.all(aufgaben));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./"));
});
