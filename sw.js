const CACHE_VERSION = 9;
const CACHE_NAME = `fitcrew-v${CACHE_VERSION}`;
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './exercises.js',
    './workout.js',
    './stats.js',
    './planner.js',
    './library.js',
    './measures.js',
    './ranking.js',
    './share.js',
    './profiles.js',
    './install.js',
    './nav.js',
    './manifest.json',
    './icon.svg',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                }));
            })
        ])
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((cached) => {
            const fetchPromise = fetch(e.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, clone);
                    });
                }
                return networkResponse;
            }).catch(() => null);

            return cached || fetchPromise.then(r => r || new Response('Offline', { status: 503 }));
        })
    );
});
