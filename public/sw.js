/* Tiny Torque service worker (MV-S9-02, F-17, 05 S9 risk note: "keep it to app shell + read-only
   garage cache"). Deliberately small and conservative — three caches, nothing else:

   1. shell   : hashed build assets (/_next/static/*), the self-hosted fonts and the handful of
                public images (icons, logo, car placeholder) — cache-first, they are immutable by
                URL. Plus the /offline page, precached at install so it is always there.
   2. garage  : exactly one HTML document — the collector's own /garage (the first page) — stored
                after every successful online visit, served ONLY when the network fails. Read-only
                by nature: every mutation is a POST / server action / Supabase call, none of which
                this worker ever touches (non-GET and cross-origin requests pass straight through).
   3. media   : the <img> responses behind /api/media/{id} for that garage (signed storage URLs,
                opaque to us) — stale-while-revalidate with a hard cap, so the cached garage has
                its photos offline. Capped and trimmed oldest-first; never the only copy of anything.

   Any other navigation that fails offline gets /offline. Nothing under /api/* except /api/media,
   nothing from supabase.co, no POST, no Range requests, no cross-origin is cached. Bump VERSION to
   drop every cache on the next activate. */

const VERSION = 'v1';
const SHELL = `tt-shell-${VERSION}`;
const GARAGE = `tt-garage-${VERSION}`;
const MEDIA = `tt-media-${VERSION}`;
const KEEP = new Set([SHELL, GARAGE, MEDIA]);

const OFFLINE_URL = '/offline';
const GARAGE_URL = '/garage';
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/tiny-torque-logo.webp', '/car-placeholder.png'];
const MEDIA_MAX_ENTRIES = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isShellAsset(url) {
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname.startsWith('/splash/')) return true;
  return /^\/(icon-\d+\.png|apple-touch-icon\.png|tiny-torque-logo\.webp|car-placeholder\.png)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Stripe, analytics: never ours
  if (req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(req, url));
    return;
  }
  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(SHELL, req));
    return;
  }
  if (url.pathname.startsWith('/api/media/') && req.destination === 'image') {
    event.respondWith(staleWhileRevalidate(MEDIA, req));
    return;
  }
  // Everything else (RSC payloads, /api/garage pages, …) is network-only.
});

async function handleNavigation(req, url) {
  try {
    const res = await fetch(req);
    // Only the garage's first page is kept (one entry, overwritten each visit). The ?__visual
    // harness render is never stored. Redirects (signed-out → /login) are not a garage either.
    if (res.ok && url.pathname === GARAGE_URL && !url.search && !res.redirected) {
      const cache = await caches.open(GARAGE);
      cache.put(GARAGE_URL, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    if (url.pathname === GARAGE_URL) {
      const cached = await caches.match(GARAGE_URL, { cacheName: GARAGE });
      if (cached) return cached;
    }
    const offline = await caches.match(OFFLINE_URL, { cacheName: SHELL });
    return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(cacheName, req) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function staleWhileRevalidate(cacheName, req) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      // 200 (same-origin) or opaque (0, the followed signed-URL redirect lands cross-origin).
      if (res.ok || res.type === 'opaque') {
        cache.put(req, res.clone()).then(() => trim(cache, MEDIA_MAX_ENTRIES)).catch(() => {});
      }
      return res;
    })
    .catch(() => undefined);
  if (hit) return hit;
  const fresh = await refresh;
  return fresh || new Response('', { status: 504 });
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
