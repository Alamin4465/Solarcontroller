const CACHE_NAME = 'solar-pwa-v1';
const urlsToCache = [
  '/Solarcontroller/',
  '/Solarcontroller/index.html',
  '/Solarcontroller/style.css', // আপনার CSS ফাইল থাকলে
  '/Solarcontroller/script.js'  // আপনার JS ফাইল থাকলে
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
