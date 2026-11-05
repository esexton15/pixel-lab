const scope = new URL(self.registration.scope)
const cachePrefix = `pixel-lab:${scope.pathname}:`
const cacheName = cachePrefix + buildVersion
const files = new Set(buildFiles.map((file) => new URL(file, scope).href))
const home = new URL('index.html', scope).href

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    await cache.addAll([...files].map((url) => new Request(url, { cache: 'reload' })))
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const isHome = request.mode === 'navigate' && url.origin === scope.origin &&
    (url.pathname === scope.pathname || url.pathname === new URL(home).pathname)
  const key = isHome ? home : request.url
  if (!files.has(key)) return

  event.respondWith((async () => {
    const cache = await caches.open(cacheName)
    return await cache.match(key) ?? fetch(request)
  })())
})
