var cacheName = 'pto-cache-v1';
var dataCacheName = 'pto-data-v1';
var filesToCache = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/styles/material.min.css',
    '/styles/font-files.css',
    '/styles/material-icons.css',
    '/styles/fonts/roboto-v18-latin-regular.woff2',
    '/styles/fonts/roboto-v18-latin-900.woff2',
    '/styles/fonts/material-icons.woff2',
    '/scripts/app.js',
    '/scripts/material.min.js',
    '/images/user.jpg',
    '/manifest.json',
    '/images/favicon.png'
];

/*****************************************************************************
 *
 * The install event is the first event a service worker gets, and it only happens once
 * A service worker won't receive events like fetch and push until it successfully finishes installing and becomes active
 *
 ****************************************************************************/
self.addEventListener('install', function(e) {
    console.log('[ServiceWorker] Install');
    e.waitUntil(
        caches.open(cacheName).then(function(cache) {
            console.log('[ServiceWorker] Caching files from cache', cache);
            return cache.addAll(filesToCache);
        })
    );
});

/*****************************************************************************
 *
 * The activate event is when the service worker is ready
 * Include some logic to update the cache
 *
 ****************************************************************************/

self.addEventListener('activate', function(e) {
    console.log('[ServiceWorker] Activate');
    e.waitUntil(
        caches.keys().then(function(keyList) {
            return Promise.all(keyList.map(function(key) {
                if (key !== cacheName && key !== dataCacheName) {
                    console.log('[ServiceWorker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

/*****************************************************************************
 *
 * Serve the app shell from the cache
 *
 ****************************************************************************/

self.addEventListener('fetch', function(e) {
    console.log('[Service Worker] Fetch', e.request.url);
    var dataUrl = 'https://polar-tundra-94573.herokuapp.com';
    if (e.request.url.indexOf(dataUrl) > -1) {
        e.respondWith(
            caches.open(dataCacheName).then(function(cache) {
                return fetch(e.request).then(function(response) {
                    cache.put(e.request.url, response.clone());
                    return response;
                });
            })
        );
    } else {
        e.respondWith(
            caches.match(e.request.url).then(function(response) {
                return response || fetch(e.request);
            })
        );
    }
});

/*****************************************************************************
 *
 * Showing push notifications to the user
 *
 ****************************************************************************/

function getEndpoint() {
    return self.registration.pushManager.getSubscription()
        .then(function(subscription) {
            if (subscription) {
                return subscription.endpoint;
            }

            throw new Error('User not subscribed');
        });
}

self.addEventListener('push', function(event) {

    event.waitUntil(
        getEndpoint()
        .then(function(endpoint) {
            let getPayloadUrl = 'https://polar-tundra-94573.herokuapp.com/getPayload?endpoint' + endpoint;
            return fetch(getPayloadUrl);
        })
        .then(function(response) {
            return response.text();
        })
        .then(function(payload) {
            self.registration.showNotification('PTO TRACKER NOTIFICATION', {
                body: payload,
            });
        })
    );
});