const CACHE_NAME = 'shift-one-staff-v9';
const PRECACHE = ['./', './index.html'];

function isInstallAsset(pathname) {
  return pathname === '/manifest.webmanifest'
    || pathname.startsWith('/icons/')
    || pathname === '/favicon.png';
}

function isHashedAsset(pathname) {
  return pathname.startsWith('/assets/');
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('script.google')) return;
  if (isInstallAsset(url.pathname)) return;

  const isNavigate = request.mode === 'navigate' || request.destination === 'document';

  // ハッシュ付きアセットはキャッシュ優先（2回目以降を速く）
  if (isHashedAsset(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone()).catch(() => undefined);
      return response;
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: isNavigate ? 'no-store' : 'default' });
      if (response && response.ok && url.origin === self.location.origin && !isNavigate) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    } catch (err) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (isNavigate) {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
