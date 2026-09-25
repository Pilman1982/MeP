/* MeP Service Worker: funktioniert auch ohne Netz */
var CACHE = 'mep-v1';
var FILES = ['./', './index.html', './parser.js', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './fonts/Barlow-Regular.woff2', './fonts/Barlow-Medium.woff2', './fonts/Barlow-SemiBold.woff2',
  './fonts/BarlowCondensed-Bold.woff2', './fonts/BarlowCondensed-ExtraBold.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Netz zuerst (immer aktuell), bei fehlendem Netz aus dem Speicher
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      if (res.ok) caches.open(CACHE).then(function (c) { c.put(url.search ? new Request(url.origin + url.pathname) : e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('./'); });
    })
  );
});
