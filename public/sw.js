/* Duuka POS service worker: lets the till open and keep selling with no connection.
 *  - /_next/static/*  : cached on first use (these files never change under the same name)
 *  - product images   : shown from cache, refreshed in the background
 *  - the /pos page    : network first (3.5 s), falls back to the last copy; the product list itself comes from IndexedDB
 *  - any other page   : network only; when offline, a small page pointing back to the till
 * Nothing under /api is ever cached here, so reports and data are never shown stale by mistake. */
const VERSION = "v1";
const STATIC = `duuka-static-${VERSION}`;
const PAGES = `duuka-pages-${VERSION}`;
const IMAGES = `duuka-img-${VERSION}`;
const KEEP = [STATIC, PAGES, IMAGES];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("duuka-") && !KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Duuka POS</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.c{max-width:24rem;text-align:center}a{display:inline-block;margin-top:12px;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600}</style></head>
<body><div class="c"><h1>You're offline</h1><p>This page needs an internet connection. The till still works: you can keep selling and your sales upload automatically when the connection is back.</p><a href="/pos">Open the till</a></div></body></html>`;
const offlineResponse = () => new Response(OFFLINE_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => undefined);
  return hit || (await network) || new Response("", { status: 504 });
}

async function posPage(request) {
  const cache = await caches.open(PAGES);
  const key = "/pos";
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 3500)),
    ]);
    // Only keep real pages; a redirect means "not signed in", which must never be served later as the till.
    if (res.ok && !res.redirected) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key)) || offlineResponse();
  }
}

// The till page asks us to save itself (and the scripts it is using) as soon as it has loaded, so the very first visit
// is already enough to work offline afterwards.
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "warm") return;
  event.waitUntil((async () => {
    const statics = await caches.open(STATIC);
    const urls = (event.data.urls || []).filter((u) => typeof u === "string" && new URL(u, self.location.origin).origin === self.location.origin);
    await Promise.all(urls.map((u) => statics.match(u).then((hit) => hit || statics.add(u)).catch(() => {})));
    try {
      const res = await fetch("/pos", { credentials: "same-origin" });
      if (res.ok && !res.redirected) await (await caches.open(PAGES)).put("/pos", res);
    } catch { /* offline right now: nothing to save */ }
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) return void event.respondWith(cacheFirst(STATIC, req));
  if (/^\/api\/products\/[^/]+\/image/.test(url.pathname)) return void event.respondWith(staleWhileRevalidate(IMAGES, req));
  if (req.mode === "navigate") {
    if (url.pathname === "/pos") return void event.respondWith(posPage(req));
    event.respondWith(fetch(req).catch(() => offlineResponse()));
  }
});
