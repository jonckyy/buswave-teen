// BusWave Service Worker — handles push notifications

// Activate immediately (don't wait for open tabs to close)
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

// Start controlling all pages immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data?.json()
  } catch {
    payload = null
  }
  if (!payload) return

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? '/icon-192.png',
      badge: payload.badge ?? '/badge-72.png',
      tag: payload.tag,
      data: payload.data,
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if possible
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
