/* Duuka POS service worker: lets the till open and keep selling with no connection.
 *  - /_next/static/*  : cached on first use (these files never change under the same name)
 *  - product images   : kept on the device (the address changes when a photo does)
 *  - the /pos page    : network first (3.5 s), falls back to the last copy; the product list itself comes from IndexedDB
 *  - read-only pages  : (dashboard, sales and receipts, products, inventory, reports) network first, then the last copy seen,
 *                       so a manager can still look things up offline. Users, settings, audit and platform pages are never saved.
 *  - any other page   : network only; when offline, a small page pointing back to the till
 * Nothing under /api is ever cached here, so reports and data are never shown stale by mistake. */
const VERSION = "v2";
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
const TILL_MISSING_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Duuka POS</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.c{max-width:24rem;text-align:center}button{margin-top:12px;background:#4f46e5;color:#fff;padding:10px 18px;border:0;border-radius:8px;font-weight:600;font-size:16px}</style></head>
<body><div class="c"><h1>The till isn't saved on this device yet</h1><p>Connect to the internet once, sign in and open the app. After that the till opens and sells with no connection.</p><button onclick="location.reload()">Try again</button></div></body></html>`;
const tillMissingResponse = () => new Response(TILL_MISSING_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
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

const READ_ONLY = [/^\/dashboard$/, /^\/sales(\/[^/]+)?$/, /^\/products$/, /^\/inventory(\/history)?$/, /^\/reports$/];
const MAX_SAVED_PAGES = 60;

async function readOnlyPage(request, url) {
  const cache = await caches.open(PAGES);
  const key = url.pathname + url.search;
  try {
    const res = await Promise.race([fetch(request), new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 5000))]);
    if (res.ok && !res.redirected) {
      await cache.put(key, res.clone());
      const keys = await cache.keys(); // keep the cache small: drop the oldest copies
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SAVED_PAGES))) if (new URL(k.url).pathname !== "/pos") await cache.delete(k);
    }
    return res;
  } catch {
    return (await cache.match(key)) || offlineResponse();
  }
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
    return (await cache.match(key)) || tillMissingResponse();
  }
}

// The app asks us to save the till (and everything it needs) as soon as someone signs in, from any screen, so the till
// works offline even if this person has never opened it. We fetch its page, read which scripts and styles it uses, and
// keep them all.
async function warmTill(extraUrls) {
  const statics = await caches.open(STATIC);
  const wanted = new Set(extraUrls.filter((u) => typeof u === "string" && new URL(u, self.location.origin).origin === self.location.origin));
  try {
    const res = await fetch("/pos", { credentials: "same-origin" });
    if (!res.ok || res.redirected) return false; // not signed in (or no till for this role): nothing to save
    const html = await res.clone().text();
    await (await caches.open(PAGES)).put("/pos", res);
    for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s<>)]+/g)) wanted.add(m[0]);
    for (const m of html.matchAll(/static\/(?:chunks|css|media)\/[^"'\\\s<>)]+/g)) wanted.add("/_next/" + m[0]); // lazily loaded pieces named in the page data
  } catch { return false; } // offline right now
  await Promise.all([...wanted].slice(0, 120).map((u) => statics.match(u).then((hit) => hit || statics.add(u)).catch(() => {})));
  return true;
}

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "warm") return;
  event.waitUntil(warmTill(event.data.urls || []).then((ok) => event.source && event.source.postMessage({ type: "warmed", ok })));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) return void event.respondWith(cacheFirst(STATIC, req));
  if (/^\/api\/products\/[^/]+\/image/.test(url.pathname)) {
    // A versioned address (?v=…) always means the same picture, so it can be kept for good; an unversioned one is re-checked.
    return void event.respondWith(url.searchParams.has("v") ? cacheFirst(IMAGES, req) : staleWhileRevalidate(IMAGES, req));
  }
  if (req.mode === "navigate") {
    if (url.pathname === "/pos") return void event.respondWith(posPage(req));
    if (READ_ONLY.some((re) => re.test(url.pathname))) return void event.respondWith(readOnlyPage(req, url));
    event.respondWith(fetch(req).catch(() => offlineResponse()));
  }
});
