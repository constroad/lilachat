/**
 * El service worker de Lilachat (F6).
 *
 * Solo notificaciones: NO cachea la app. Un cache mal invalidado en una app de
 * mensajería sirve mensajes viejos, y el historial ya se sincroniza por cursor
 * — cachear el bundle es una optimización que puede esperar a tener usuarios.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Lilachat', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Lilachat', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Una notificación por chat: diez mensajes del mismo grupo no apilan diez
      // avisos, reemplazan el anterior.
      tag: payload.data?.chatId || 'lilachat',
      data: payload.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const url = chatId ? `/?chat=${chatId}` : '/';

  // Si la app ya está abierta se ENFOCA esa pestaña en vez de abrir otra:
  // acumular pestañas de la misma app es la queja clásica de las web apps.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url.includes(self.location.origin));
      if (open) {
        open.focus();
        return open.navigate(url);
      }
      return self.clients.openWindow(url);
    })
  );
});
