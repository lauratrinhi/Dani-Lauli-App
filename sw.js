self.addEventListener("push", (event) => {
  const daten = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(daten.title || "Wir zwei 💕", {
      body: daten.body || "Zeit für ein Foto! Du hast 2 Minuten 📸"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./"));
});
