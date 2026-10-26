const CACHE_NAME = 'rupeerise-v13';
const urlsToCache = [
  '/',
  '/dashboard',
  '/expenses',
  '/bills',
  '/calendar',
  '/salary',
  '/savings-goals',
  '/reports',
  '/settings',
  '/login',
  '/register',
  '/manifest.json',
  '/favicon.png',
  '/images/rupeerise-logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('[SW] Cache addAll partial skip:', err);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const cacheAllowlist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheAllowlist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;
  
  // Don't intercept API requests or browser extensions
  if (event.request.url.includes('/api/')) return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

/* =========================================================================
   REAL BACKGROUND PUSH NOTIFICATIONS
   Triggers OS / system notification area even when browser tab is closed
   ========================================================================= */
self.addEventListener('push', event => {
  console.log('[SW] Push event received');
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    data = {
      title: 'RupeeRise Reminder',
      body: event.data ? event.data.text() : 'You have an upcoming bill payment.'
    };
  }

  const title = data.title || 'RupeeRise Financial Alert';
  const options = {
    body: data.body || 'Open RupeeRise to manage your bills and safe-to-spend balance.',
    icon: data.icon || '/images/rupeerise-logo.png',
    badge: data.badge || '/favicon.png',
    vibrate: [200, 100, 200],
    tag: data.data?.billId ? `bill-${data.data.billId}` : 'rupeerise-reminder',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/calendar',
      ...(data.data || {})
    },
    actions: [
      { action: 'open_app', title: 'Open RupeeRise' },
      { action: 'view_calendar', title: 'View Calendar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click action:', event.action);
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/calendar';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If a RupeeRise window/tab is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
