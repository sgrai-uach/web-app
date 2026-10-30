/* ==========================================================================
   Service Worker — SGRAI PWA (Municipalidad de Valdivia)
   Estrategia de caché para assets estáticos y soporte offline-first.
   ========================================================================== */

const CACHE_NAME = 'sgrai-pwa-v5';

const STATIC_ASSETS = [
  '/terreno/favicon.ico',
  '/terreno/site.webmanifest',
  '/terreno/manifest.webmanifest',
  '/terreno/android-chrome-192x192.png',
  '/terreno/android-chrome-512x512.png',
];

// Instalación: pre-caching de assets esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Advertencia al pre-cachear assets estáticos:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activación: limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Intercepción de peticiones (Network First con fallback a Cache para navegación)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // No interceptar peticiones a la API ni a Socket.io
  if (
    request.url.includes('/api/') ||
    request.url.includes('/socket.io/') ||
    request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clonar y almacenar en caché solo respuestas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // En caso de fallo de red, intentar servir desde caché
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si era navegación a página, retornar fallback de la raíz de terreno
          if (request.mode === 'navigate') {
            return caches.match('/terreno');
          }
          return new Response('Sin conexión', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        });
      })
  );
});

// Manejador de sincronización en segundo plano (Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'PROCESS_OFFLINE_QUEUE' });
        });
      })
    );
  }
});
