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

// "assets/index-AbC123.js" -> "index.js": the file identity without its content hash.
const stem = (url) => url.match(/assets\/(.+)-[\w-]{6,}(\.\w+)$/)?.slice(1).join('') ?? null;

/**
 * Drops cached build assets that were replaced by a newer hashed version of the
 * same file. Only runs on our own page (never on a captive portal or proxy page),
 * and assets the HTML does not mention (lazy chunks, textures) are kept.
 */
async function pruneAssets(html) {
  if (!html.includes('id="app"')) return;
  const live = new Map();
  for (const [ref] of html.matchAll(/assets\/[^"'\s)]+/g)) {
    const url = new URL(ref, self.registration.scope).href;
    if (stem(url)) live.set(stem(url), url);
  }
  if (!live.size) return;
  const cache = await caches.open(CACHE);
  for (const request of await cache.keys()) {
    const current = live.get(stem(request.url));
    if (current && current !== request.url) await cache.delete(request);
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
