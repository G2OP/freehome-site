// sw.js — Service Worker FREEHOME PWA
// Strategie : Cache First pour app shell + assets, Network First pour API

const CACHE_NAME = 'freehome-v2.1.0'
const API_CACHE = 'freehome-api-v1'

// App shell — fichiers critiques a cacher immediatement
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.js'
]

// ─────────────────────────────────────────────────────────────────
// INSTALL — pre-cache de l'app shell
// ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  // Ne PAS appeler skipWaiting() ici — laisser le SW passer par "waiting"
  // pour que le toast de mise à jour s'affiche dans l'app
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  )
})

// ─────────────────────────────────────────────────────────────────
// ACTIVATE — nettoyage des anciens caches
// ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== API_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ─────────────────────────────────────────────────────────────────
// FETCH — routage par strategie
// ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Ignorer les requetes non-GET
  if (event.request.method !== 'GET') return

  // API — Network First avec fallback cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(event.request, API_CACHE))
    return
  }

  // Google Fonts — Cache First longue duree
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirstStrategy(event.request, CACHE_NAME))
    return
  }

  // Images externes (ibb.co etc.) — Cache First 7 jours
  if (url.hostname.includes('ibb.co') || url.hostname.includes('imgur.com')) {
    event.respondWith(cacheFirstStrategy(event.request, CACHE_NAME))
    return
  }

  // App shell et assets — Cache First avec mise a jour en arriere-plan
  event.respondWith(staleWhileRevalidate(event.request, CACHE_NAME))
})

// ─────────────────────────────────────────────────────────────────
// STRATEGIES
// ─────────────────────────────────────────────────────────────────

// Cache First — sert depuis le cache, tombe sur le reseau si absent
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

// Network First — essaie le reseau, fallback cache
async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ success: false, error: 'Hors ligne', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Stale While Revalidate — sert le cache, met a jour en arriere-plan
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  }).catch(() => cached)

  return cached || fetchPromise
}

// ─────────────────────────────────────────────────────────────────
// MESSAGE — ecoute SKIP_WAITING pour mise a jour immediate
// ─────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
