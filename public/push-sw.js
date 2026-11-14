self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.slice(0, 100) : 'Study Hub'
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 240) : 'You have a new Study Hub notification.'
  const rawUrl = typeof payload.url === 'string' ? payload.url : '/'
  let url = '/'
  try {
    const parsed = new URL(rawUrl, self.location.origin)
    if (parsed.origin === self.location.origin) url = parsed.pathname + parsed.search + parsed.hash
  } catch { /* keep the same-origin root */ }
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/pwa-192.png',
    badge: '/studyhub-icon.svg',
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 80) : 'studyhub-notification',
    renotify: false,
    data: { url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = typeof event.notification.data?.url === 'string' ? event.notification.data.url : '/'
  let target = new URL('/', self.location.origin)
  try {
    const parsed = new URL(rawUrl, self.location.origin)
    if (parsed.origin === self.location.origin) target = parsed
  } catch { /* keep the same-origin root */ }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(target.href)
        return
      }
    }
    await self.clients.openWindow(target.href)
  })())
})
