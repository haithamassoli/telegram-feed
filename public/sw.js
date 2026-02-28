const CACHE_NAME = "telestream-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip WebSocket and Telegram API requests
  const url = new URL(request.url);
  if (
    url.hostname.includes("telegram.org") ||
    url.protocol === "wss:" ||
    url.protocol === "ws:"
  ) {
    return;
  }

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith("http")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Cache successful same-origin responses
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // Return cached version immediately if available, otherwise wait for network
      return cached || networkFetch;
    })
  );
});
