const STATIC_CACHE = 'ariri-static-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/db.js',
  '/js/sync.js',
  '/js/resize.js',
  '/js/app.js',
  '/js/pages/splash.js',
  '/js/pages/info.js',
  '/js/pages/day-detail.js',
  '/js/pages/forms.js',
  '/js/pages/form-new.js',
  '/js/pages/diary.js',
  '/js/pages/post-new.js',
  '/js/pages/menu.js',
  '/js/pages/accounts.js',
  '/js/pages/receipt-new.js',
  '/js/pages/team.js',
  '/js/pages/volunteer-profile.js',
  '/assets/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== STATIC_CACHE)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;

          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
  }
});
