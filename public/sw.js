self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icon.png',
      badge: '/icon.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/chat',
        type: data.type,
        symptomNames: data.symptomNames
      },
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

// When the user clicks the pop-up notification banner, open the app
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  
  const data = event.notification.data || {}
  let url = data.url || '/chat'
  
  // If this is a symptom follow-up, pass symptom names in URL params
  // so the chat page knows to trigger an automatic opening message
  if (data.type === 'symptom_followup' && data.symptomNames && data.symptomNames.length > 0) {
    const params = new URLSearchParams({
      type: 'symptom_followup',
      symptoms: data.symptomNames.join(',')
    })
    url = `/chat?${params.toString()}`
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
