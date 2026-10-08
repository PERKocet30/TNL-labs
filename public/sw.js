/* Minimal service worker — enough to make the app installable and to
   serve the shell when offline. Deliberately does NOT cache API calls;
   stale social data is worse than no social data. */
/* Bump this on every deploy that changes the shell. A stale cached
   index.html will happily serve a broken build forever otherwise. */
const CACHE = "tnl-shell-v10";  // v10: the media cache is bounded (2026-10-08)
/* v3 (2026-10-08): the media cache was unbounded — every picture ever
   scrolled past, kept forever, on phones that are short of storage. v2 is
   deleted on activate; v3 keeps only small things (avatars, feed copies,
   covers under MEDIA_MAX_BYTES), at most MEDIA_MAX files, oldest out
   first, and nothing at all when the phone is nearly full. */
const MEDIA = "tnl-media-v3";
const MEDIA_MAX = 80, MEDIA_MAX_BYTES = 1024 * 1024, MEDIA_MIN_FREE = 200 * 1024 * 1024;
async function roomToCache() {
  try { const e = await self.navigator.storage.estimate(); return !e.quota || e.quota - (e.usage || 0) > MEDIA_MIN_FREE; }
  catch (err) { return true; }
}
async function mediaPut(c, req, res) {
  const len = Number(res.headers.get("content-length") || 0);
  if (!len || len > MEDIA_MAX_BYTES || !(await roomToCache())) return;
  try {
    await c.put(req, res);
    const keys = await c.keys();   // insertion order: the oldest first
    for (const k of keys.slice(0, Math.max(0, keys.length - MEDIA_MAX))) await c.delete(k);
  } catch (err) {}
}
/* Only things that definitely exist. If addAll() 404s on ANY entry the whole
   install rejects and the worker never activates — a silent failure. */
const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;          // always live
  /* NEVER serve a cached page shell. If the network is up, the network
     wins — otherwise one bad deploy is cached on someone's phone forever
     and no amount of redeploying fixes it for them. */
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
    return;
  }
  if (url.pathname.startsWith("/uploads/")) {            // media: cache after first view
    /* Audio and video fetch with Range headers, and both halves of the old
       code broke them: answering a ranged request from a cached full 200 is
       rejected by iOS media loading, and Cache.put() THROWS on the 206
       partial the network returns — either way the track died inside the
       service worker, which is exactly the "works in the bookmark, dead in
       Safari" split (iOS gives the two separate storage containers, and
       only Safari's held the poisoned state). Ranged requests now bypass
       the worker entirely — the browser talks to the server natively — and
       only clean, full 200s are ever cached. */
    if (e.request.headers.get("range")) return;
    e.respondWith(
      caches.open(MEDIA).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.status === 200) e.waitUntil(mediaPut(c, e.request, res.clone()));
        return res;
      })
    );
    return;
  }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
});
