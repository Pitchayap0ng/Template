const CACHE_VERSION = 'mf-v1';
const CACHE_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600&display=swap',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
];

// Install Service Worker
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => {
            console.log('[Service Worker] Caching assets');
            return cache.addAll(CACHE_ASSETS).catch(err => {
                console.log('[Service Worker] Cache error:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_VERSION) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Network first, fall back to cache
self.addEventListener('fetch', event => {
    const { request } = event;

    if (request.method !== 'GET' || request.url.includes('chrome://')) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_VERSION).then(cache => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(request).then(response => {
                    if (response) {
                        console.log('[Service Worker] Serving from cache:', request.url);
                        return response;
                    }

                    if (request.headers.get('accept').includes('text/html')) {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
