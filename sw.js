const CACHE_VERSION = 'passbook-v1';
const CACHE_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    'https://fonts.googleapis.com/css2?family=Taviraj:wght@400;500;600;700&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => cache.addAll(CACHE_ASSETS).catch(err => {
            console.log('[Service Worker] Cache error:', err);
        }))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== CACHE_VERSION) return caches.delete(cacheName);
            })
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || request.url.startsWith('chrome://')) return;

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put(request, responseToCache));
                }
                return response;
            })
            .catch(() => caches.match(request).then(response => {
                if (response) return response;
                if (request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/index.html');
                }
            }))
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
