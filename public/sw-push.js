// Prospect’Immo — notifications (chargé par le service worker de l'application).
self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { titre: 'Prospect’Immo', corps: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(d.titre || 'Prospect’Immo', {
      body: d.corps || '',
      tag: d.tag,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: d.url || '/' },
      renotify: !!d.tag,
    }),
  )
})

// Appui sur la notification : ouvre la fiche concernée (dans l'application déjà ouverte si possible).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (new URL(f.url).origin === self.location.origin && 'focus' in f) {
          return f.focus().then((g) => (g && 'navigate' in g ? g.navigate(url) : undefined))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
