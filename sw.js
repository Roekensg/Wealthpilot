const CACHE = 'wealthpilot-v1.3';
const SHELL = ['./', './index.html', './app.css', './app.js', './catalog.js', './app.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/data/market.json')) {
    const stableKey = new Request(new URL('./data/market.json', self.registration.scope));
    event.respondWith(fetch(event.request, {cache:'no-store'}).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(stableKey, copy)); }
      return response;
    }).catch(() => caches.match(stableKey)));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
