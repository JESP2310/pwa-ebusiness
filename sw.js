const CACHE = 'FraTech-v1';
const ASSETS = [
    './',              
    './index.html',    
    './css/style.css',
    './js/db.js',
    './js/app.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(n => n !== CACHE).map(n => caches.delete(n))
            ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    if (url.pathname.includes('/wp-json/')) {
        e.respondWith(
            fetch(e.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => cache.put(e.request, clone));
                    return response;
                })
                .catch(() => caches.match(e.request))
        );
    } else {
        e.respondWith(
            caches.match(e.request)
                .then(response => {
                    if (response) return response;
                    return fetch(e.request).catch(() => {
                        if (e.request.destination === 'document') {
                            return caches.match('./index.html'); 
                        }
                    });
                })
        );
    }
});