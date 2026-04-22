// Sketch3D Service Worker — cache-first strategy
const CACHE = 'sketch3d-v40';
const ASSETS = [
  '/sketchbook-v3/',
  '/sketchbook-v3/index.html',
  '/sketchbook-v3/manifest.json',
  '/sketchbook-v3/icon72.png',
  '/sketchbook-v3/icon96.png',
  '/sketchbook-v3/icon128.png',
  '/sketchbook-v3/icon144.png',
  '/sketchbook-v3/icon152.png',
  '/sketchbook-v3/icon192.png',
  '/sketchbook-v3/icon384.png',
  '/sketchbook-v3/icon512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
