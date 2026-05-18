const CACHE_NAME = 'corpflow-cache-v2';
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

// Network First for dynamic content - prevents stale data
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Bypass API calls and dynamic routes - always fetch fresh
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/dashboard')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Network first for navigation requests - prevents frozen splash
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
  
  // Cache first for static assets
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
