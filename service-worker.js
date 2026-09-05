/* CashPilot service worker: local, explicit, same-origin offline cache. */

const CACHE_NAME = 'cashpilot-v9-pwa-icons';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './files/icon-192.png',
  './files/icon-512.png',
  './files/icon-192-maskable.png',
  './files/icon-512-maskable.png',
  './vendor/chart.js-4.4.0/chart.umd.js',
  './src/main.js',
  './src/core/constants.js',
  './src/core/i18n.js',
  './src/core/state.js',
  './src/core/utils.js',
  './src/storage/db.js',
  './src/services/finance.js',
  './src/services/backup.js',
  './src/services/print.js',
  './src/services/market.js',
  './src/services/notifications.js',
  './src/services/smart-engine.js',
  './src/ui/toast.js',
  './src/ui/modal.js',
  './src/ui/nav.js',
  './src/ui/install.js',
  './src/ui/privacy.js',
  './src/ui/components.js',
  './src/charts/chartConfig.js',
  './src/charts/charts.js',
  './src/pages/dashboard.js',
  './src/pages/income.js',
  './src/pages/expenses.js',
  './src/pages/debts.js',
  './src/pages/investments.js',
  './src/pages/subscriptions.js',
  './src/pages/budget.js',
  './src/pages/analytics.js',
  './src/pages/transactions.js',
];

const STATIC_URLS = new Set(STATIC_ASSETS.map(path => {
  const url = new URL(path, self.location.href);
  url.search = '';
  return url.href;
}));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name.startsWith('cashpilot-') && name !== CACHE_NAME)
          .map(name => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put('./index.html', response.clone());
          }
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  const normalized = new URL(request.url);
  normalized.search = '';
  if (!STATIC_URLS.has(normalized.href)) return;

  const refreshed = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });
  event.waitUntil(refreshed.then(() => undefined).catch(() => undefined));
  event.respondWith(caches.match(request, { ignoreSearch: true }).then(cached => cached || refreshed));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_NAME });
  }
  if (event.data?.type === 'SEND_NOTIFICATION') {
    const { title, body, tag, link } = event.data;
    self.registration.showNotification(String(title || ''), {
      body: String(body || ''),
      icon: './files/icon-192.png',
      badge: './files/icon-192-maskable.png',
      tag: String(tag || 'cashpilot-notif'),
      data: { link: typeof link === 'string' ? link : null },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    }).catch(error => console.warn('[SW] showNotification failed:', error));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetLink = typeof event.notification.data?.link === 'string'
    ? event.notification.data.link
    : null;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          client.focus();
          if (targetLink) client.postMessage({ type: 'NAVIGATE_TO', page: targetLink });
          return undefined;
        }
      }
      return clients.openWindow('./' + (targetLink ? '#' + targetLink : ''));
    }),
  );
});
