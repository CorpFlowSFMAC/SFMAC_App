const CACHE_NAME = 'corpflow-cache-v3';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/logo-final.png'
];

// Skip waiting immediately - activate new version without waiting for reload
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache).catch(() => {}))
  );
});

// Clean old caches and claim clients immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ═══════════════════════════════════════════════════════════════════
// Service Worker STRICT - No caching para dashboard administrativo
// Las métricas financieras requieren datos frescos en tiempo real
// ═══════════════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  
  // ═══════════════════════════════════════════════════════════════════
  // REGLA 1: NUNCA cachear rutas administrativas dinámicas
  // ═══════════════════════════════════════════════════════════════════
  const adminRoutes = [
    '/dashboard',
    '/api',
  ];
  
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    // SIEMPRE fetch de red, nunca del caché
    event.respondWith(
      fetch(event.request)
    );
    return;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // REGLA 2: Network first para navegación (páginas HTML)
  // ═══════════════════════════════════════════════════════════════════
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // REGLA 3: Cache first para assets estáticos (imágenes, CSS, JS)
  // ═══════════════════════════════════════════════════════════════════
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
