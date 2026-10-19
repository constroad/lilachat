/**
 * El service worker de Lilachat Web (W4). Reglas:
 * 1. Lo sirve el server por `/service-worker` sin extensión ni caché; él pone la VERSION.
 * 2. Cache-first SOLO para `/assets/*` (tienen hash, no cambian).
 * 3. Navegación: red con 4 s de espera; sin red, la app guardada (los chats salen de IndexedDB).
 * 4. La API y el socket NUNCA pasan por acá: los datos sin red viven en IndexedDB.
 * 5. La versión nueva espera hasta que la página pide `{ tipo: 'activar' }` («Recargar»).
 * 6. Los avisos push abren el chat; si la app ya está abierta, la enfocan.
 */
const VERSION = '__VERSION__';
const CACHE = `lilachat-${VERSION}`;
const SHELL = '/';
const ESPERA_DE_RED_MS = 4000;

/** Al instalar: la app y los archivos que nombra, para que la primera vez sin red ya abra. */
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const respuesta = await fetch(new Request(SHELL, { cache: 'reload' }));
      await cache.put(SHELL, respuesta.clone());
      const html = await respuesta.text();
      const archivos = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((coincidencia) => coincidencia[1]);
      await cache.addAll(archivos);
    })()
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((nombre) => nombre.startsWith('lilachat-') && nombre !== CACHE).map((nombre) => caches.delete(nombre))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'activar') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return;
  if (url.pathname.startsWith('/assets/')) return evento.respondWith(primeroLaCache(pedido));
  if (pedido.mode === 'navigate') evento.respondWith(primeroLaRed(pedido));
});

async function primeroLaCache(pedido) {
  const guardada = await caches.match(pedido);
  if (guardada) return guardada;
  const respuesta = await fetch(pedido);
  if (respuesta.ok) (await caches.open(CACHE)).put(pedido, respuesta.clone());
  return respuesta;
}

/** La red con tope de espera; si no contesta, la app guardada (toda ruta es la misma SPA). */
async function primeroLaRed(pedido) {
  try {
    const respuesta = await Promise.race([fetch(pedido), new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('lenta')), ESPERA_DE_RED_MS))]);
    if (respuesta.ok) (await caches.open(CACHE)).put(SHELL, respuesta.clone());
    return respuesta;
  } catch {
    return (await caches.match(SHELL)) ?? Response.error();
  }
}

self.addEventListener('push', (evento) => {
  if (!evento.data) return;
  let datos = { title: 'Lilachat', body: '' };
  try { datos = evento.data.json(); } catch { datos.body = evento.data.text(); }
  // Una notificación por chat: diez mensajes del mismo grupo reemplazan la anterior.
  evento.waitUntil(
    self.registration.showNotification(datos.title || 'Lilachat', {
      body: datos.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: datos.data?.chatId || 'lilachat',
      data: datos.data || {},
    })
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const chatId = evento.notification.data?.chatId;
  const url = chatId ? `/c/${chatId}` : '/';
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((ventana) => ventana.url.startsWith(self.location.origin));
      if (abierta) return abierta.focus().then(() => abierta.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});
