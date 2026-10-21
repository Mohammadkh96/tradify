const CACHE_NAME = "tradify-app-shell-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/tradify-192.png", "/icons/tradify-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(async (cache) => {
        const appShell = await fetch("/app/", { headers: { accept: "text/html" } });
        if (!appShell.ok) throw new Error(`Could not cache the app shell: ${appShell.status}`);
        await cache.put("/app/", appShell);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("tradify-app-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Tradify signal update", body: event.data?.text?.() ?? "" };
  }
  const title = typeof payload.title === "string" ? payload.title : "Tradify signal update";
  const body = typeof payload.body === "string" ? payload.body : "Open Tradify Signals to review.";
  const tag = typeof payload.id === "string" ? payload.id : undefined;
  const url = typeof payload.url === "string" ? payload.url : "/app/notifications";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: false,
      data: { url },
      icon: "/icons/tradify-192.png",
      badge: "/icons/tradify-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = new URL(
    typeof event.notification.data?.url === "string" ? event.notification.data.url : "/notifications",
    self.location.origin,
  );
  if (!requested.pathname.startsWith("/app/") && requested.pathname !== "/app") {
    requested.pathname = `/app${requested.pathname === "/" ? "/" : requested.pathname}`;
  }
  const targetUrl = requested.origin === self.location.origin ? requested.href : `${self.location.origin}/notifications`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/tradify-admin" || url.pathname.startsWith("/tradify-admin/")) return;

  if (request.mode === "navigate") {
    const isAppRoute = url.pathname === "/app" || url.pathname.startsWith("/app/");
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && (url.pathname === "/" || url.pathname === "/app/")) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(async () =>
          (await caches.match(isAppRoute ? "/app/" : "/")) || Response.error(),
        ),
    );
    return;
  }

  if (
    url.pathname.includes("/_expo/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }),
    );
  }
});
