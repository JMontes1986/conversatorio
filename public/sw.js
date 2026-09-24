const CACHE_NAME = "conversatorio-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("conversatorio-static-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

function cacheable(request, response) {
  if (request.method !== "GET" || !response || !response.ok) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  return url.pathname.startsWith("/_next/static/")
    || url.pathname.startsWith("/icons/")
    || /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = url.pathname.startsWith("/_next/static/")
    || /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (!isStatic) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);

      const networkPromise = fetch(request)
        .then((response) => {
          if (cacheable(request, response)) {
            void cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkPromise;
    }),
  );
});
