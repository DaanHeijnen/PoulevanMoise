const CACHE_NAME = 'poule-van-moise-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/wedstrijden.html',
  '/rankings.html',
  '/assets/css/app.css',
  '/assets/js/app.js',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/maskable-icon-512.png',
  '/assets/apple-touch-icon.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/.netlify/functions/')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503
    })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
      return response;
    }))
  );
});
