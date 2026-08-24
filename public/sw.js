/**
 * Kiosk service worker.
 *
 * The job is narrow: keep the terminal usable through a café wifi hiccup, and
 * make the installed app launch instantly. It is NOT a general offline mode —
 * the kiosk already has one where it matters, in the IndexedDB submission queue
 * (§43), which is the only thing whose loss would actually cost the café data.
 *
 * WHAT THIS MUST NOT BREAK, and the reason the routing below is so explicit:
 *
 *  - §3 promises a manager can change any string and see it on the kiosk
 *    without a redeploy. A cache-first HTML strategy would make that a lie for
 *    as long as the cache lived.
 *  - §8b promises the memory-print kill switch reaches the kiosk "within
 *    seconds". A stale page or a cached config response would hold a camera
 *    open that a manager had just switched off.
 *  - The submit is the one request that must never be replayed from a cache or
 *    served a stale response.
 *
 * So: documents and data are network-first or network-only, and only
 * content-addressed static assets are cache-first. The cache is a safety net
 * under the network, never a layer in front of it.
 */

const VERSION = 'aic-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

/**
 * Enough to draw a screen if the network is gone at launch. Deliberately small:
 * a precache list that includes pages goes stale, and stale kiosk copy is worse
 * than a slow one.
 */
const PRECACHE = ['/offline', '/brand/logo.webp', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Individually, so one missing asset does not fail the whole install and
      // leave the kiosk with no worker at all.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      // Take over open tabs immediately. On a kiosk that reboots into one tab,
      // waiting for a navigation would mean the new worker never activates.
      .then(() => self.clients.claim()),
  )
})

/** Content-addressed or effectively immutable — safe to serve from cache first. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/artwork/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:woff2?|png|webp|jpg|jpeg|svg|ico)$/.test(url.pathname)
  )
}

/** Anything whose staleness would be a correctness bug rather than a slow load. */
function isNeverCacheable(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    // The RSC payload for a page is the page. Caching it stales the copy just
    // as surely as caching the HTML would.
    url.searchParams.has('_rsc')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never touch anything that changes state. A replayed POST is a duplicate
  // submission, and the idempotency key is a backstop, not a licence.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // The print agent lives on 127.0.0.1 and is not ours to intercept.
  if (url.port === '9100') return

  if (isNeverCacheable(url)) return // straight to the network, uncached

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              void caches.open(ASSETS).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(SHELL).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          // Network gone. The last good copy of THIS screen, then the offline
          // page. A guest mid-journey keeps their draft either way — it lives in
          // sessionStorage and the queue, not in anything served from here.
          return (await caches.match(request)) ?? (await caches.match('/offline')) ?? Response.error()
        }),
    )
  }
})
