// Service Worker für das Ladetagebuch.
// Strategie:
//   - index.html: network-first (mit Cache-Fallback offline)
//   - alle übrigen Assets: cache-first
// Beim Update statischer Assets (Fonts/Icons/Manifest) CACHE_VERSION hochzählen.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `ladetagebuch-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './fonts/dmmono-400.woff2',
  './fonts/dmmono-400-ext.woff2',
  './fonts/dmmono-500.woff2',
  './fonts/dmmono-500-ext.woff2',
  './fonts/syne.woff2',
  './fonts/syne-ext.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;

  const isHTML = request.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');

  if (isHTML) {
    event.respondWith(
      fetch(request).then((response) => {
        // Nur erfolgreiche Antworten cachen. Sonst landet eine 404/502 von
        // GitHub Pages (z. B. während eines Deploys) im Cache und wird
        // offline dauerhaft statt der App ausgeliefert.
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
        }
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Statische Assets: cache-first, Treffer aus dem Netz nachcachen, damit
  // eine Datei, die nicht im Precache steht, nicht bei jedem Aufruf neu lädt.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
