const APP_SHELL_CACHE = 'fortnite-jam-mixer-shell-v3';
const RUNTIME_CACHE = 'fortnite-jam-mixer-runtime-v3';
const APP_SHELL = ['/', '/index.html', '/offline.css', '/manifest.webmanifest'];
const RUNTIME_PREFIXES = [
  'https://cdn.tailwindcss.com',
  'https://api.allorigins.win/raw?url=https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks',
  'https://corsproxy.io/?https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks'
];
const FIREBASE_BYPASS_PATTERNS = ['firebaseio.com', 'firebasedatabase.app', 'www.gstatic.com/firebasejs'];

function shouldBypassCaching(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return true;
  return FIREBASE_BYPASS_PATTERNS.some((pattern) => request.url.includes(pattern));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (shouldBypassCaching(request)) return;
  const isNavigation = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  const shouldRuntimeCache =
    RUNTIME_PREFIXES.some((prefix) => request.url.startsWith(prefix)) ||
    url.pathname.includes('spark-tracks');

  if (shouldRuntimeCache) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
