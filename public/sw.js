const CACHE_NAME = 'slimcare-ultra-v1';

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - claim clients to start intercepting requests immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch event - Basic pass-through (network first) to satisfy PWA install requirements
// We're not doing heavy offline caching for MVP, just ensuring it installs.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // If network fails, we could serve a custom offline page here.
      // For now, it will just show the browser's default offline page if the asset isn't cached.
      return caches.match(event.request);
    })
  );
});
