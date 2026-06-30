// ─── SERVICE WORKER — robo.celular.chile ───────────────────────────────────
// Versión: 2026-06-30-v2
// Estrategia: Cache-first para assets, network-first para HTML, stale-while-revalidate para fuentes

const CACHE_NAME    = 'robo-celular-v2';
const FONTS_CACHE   = 'robo-celular-fonts-v1';
const OFFLINE_URL   = '/';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
];

// ── Instalación: precachear assets críticos ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activación: limpiar caches viejos ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== FONTS_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ──
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Fuentes Google: stale-while-revalidate con cache dedicado
  if (FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(
      caches.open(FONTS_CACHE).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Solo manejar origen propio para el resto
  if (url.origin !== location.origin) return;

  const isHTML = event.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // Network-first: intentar red, caer en caché si falla
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
  } else {
    // Cache-first: servir desde caché, actualizar en background
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});
