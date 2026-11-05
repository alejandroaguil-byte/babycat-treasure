// Offline support: pages are network-first (fresh when online), other same-origin
// files are cache-first. Hashed build assets are cached the first time they load.
const CACHE = 'babycat-v1.1.0';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Drops cached build assets that the latest page no longer references. */
async function pruneAssets(html) {
  const live = new Set([...html.matchAll(/assets\/[^"'\s)]+/g)].map((m) => new URL(m[0], self.registration.scope).href));
  const cache = await caches.open(CACHE);
  for (const request of await cache.keys()) {
    if (request.url.includes('/assets/') && !live.has(request.url)) await cache.delete(request);
  }
}

const store = (request, response) => {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) response.clone().text().then(pruneAssets);
          return store(request, response);
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./index.html'))),
    );
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then((response) => store(request, response))));
});
