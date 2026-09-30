// Service Worker for Kalimat (Offline PWA)
const STATIC_CACHE_NAME = "kalimat-static-v2.6";
const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./word.html",
    "./privacy.html",
    "./style.css",
    "./app-core.js",
    "./web-ui.js",
    "./revamp.js",
    "./words.js",
    "./app.js",
    "./extension/shared/review-policy.js",
    "./extension/shared/speech.js",
    "./manifest.webmanifest",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/fonts/Amiri-Regular.woff2",
    "./assets/fonts/Amiri-Bold.woff2",
    "./assets/fonts/Outfit-Regular.woff2"
];
const WORKER_BASE_URL = new URL("./", self.location.href);
const CANONICAL_PAGES = new Set(["./", "./index.html", "./word.html", "./privacy.html"]
    .map(page => new URL(page, WORKER_BASE_URL).href));

// Cache key without query string, so deep links map onto canonical pages.
function canonicalUrlFor(url) {
    return url.origin + url.pathname;
}


self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key.startsWith("kalimat-") && key !== STATIC_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // The website uses only local resources; external requests stay unmanaged.
    if (url.origin !== self.location.origin) return;

    // HTML Navigation: Network-first with fallback to cache.
    // Only canonical pages are cached so ?id/?date deep links don't pile up entries.
    if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
        const isCanonical = CANONICAL_PAGES.has(canonicalUrlFor(url));
        event.respondWith(
            fetch(request).then(networkResponse => {
                if (networkResponse && networkResponse.ok && isCanonical) {
                    const clone = networkResponse.clone();
                    caches.open(STATIC_CACHE_NAME).then(cache => cache.put(new Request(canonicalUrlFor(url)), clone));
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(request)
                    .then(cached => cached || caches.match(canonicalUrlFor(url)))
                    .then(cached => cached || caches.match("./word.html"))
                    .then(cached => cached || caches.match("./index.html"));
            })
        );
        return;
    }

    // App shell: Stale-While-Revalidate. Cache serves instantly; the network
    // response refreshes it in the background. Cache versioning (bumped with
    // every deploy) keeps HTML/CSS/JS from drifting apart.
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.open(STATIC_CACHE_NAME).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    const networkFetch = fetch(request).then(networkResponse => {
                        if (networkResponse && networkResponse.ok) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);
                    return cachedResponse || networkFetch;
                });
            })
        );
        return;
    }

});
