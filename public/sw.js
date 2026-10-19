// Service worker: makes the app load with no connection, from the very first launch.
// Runs in its own scope, separate from the page, and is registered in main.tsx.
//
// At build time (see vite.config.ts) the two lines marked BUILD below are filled in
// with a fingerprint of this build and the list of every file in it. On install the
// whole list is downloaded and cached, so the app works offline immediately, not
// only after a second visit.
//
//  - Page loads (navigations): network first so a new version arrives as soon as
//    you're online, but give up after a few seconds and use the cached copy, so a
//    weak signal can't hang the app.
//  - Everything else: cache first.
//  - Each build has its own cache; the previous build's cache is deleted on activate,
//    so old files never pile up.
//
// Your data is in localStorage, not here, so clearing this cache never touches it.
const BUILD = 'dev' // BUILD: replaced with a fingerprint of the build
const PRECACHE = [] /* BUILD: replaced with the list of files in the build */
const CACHE = `cairn-${BUILD}`
const NETWORK_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Cached files are looked up by address alone. The page asks for its scripts in CORS
// mode (an Origin header), and some servers answer those with `Vary: Origin`, which would
// make a file cached during install look like a different resource and fail offline.
const MATCH = { ignoreVary: true }

function fetchWithTimeout(request) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)
  })
  return Promise.race([fetch(request), timeout]).finally(() => clearTimeout(timer))
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(request)
        .then((response) => {
          // Only a good page replaces the cached one: an error page must never become "the app".
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          }
          return response
        })
        .catch(() => caches.match('./index.html', MATCH)),
    )
    return
  }

  event.respondWith(
    caches.match(request, MATCH).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
