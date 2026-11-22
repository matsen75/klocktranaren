// Service worker: gör att spelet går att installera och spela utan nät.
// Hämtar alltid senaste versionen när det finns nät, och använder sparad kopia annars.
// Höj VERSION när filerna ändras.
const VERSION = 'v6';
const CACHE = `klocktranaren-${VERSION}`;
const FILES = [
  './', './index.html', './style.css', './game.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' går förbi webbläsarens HTTP-cache så att vi sparar de nyaste filerna
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('klocktranaren-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  if (isFont) {
    // Typsnitt ändras aldrig: sparad kopia först.
    e.respondWith(caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Spelets egna filer: nätet först (alltid senaste versionen), sparad kopia om nätet saknas.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || (await cache.match('./'));
      return new Response('', { status: 504 });
    }
  })());
});
