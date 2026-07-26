/* ============================================================
   Service Worker — ميزانيتي PWA
   يتيح العمل الكامل بدون اتصال إنترنت
   ============================================================ */

const CACHE_NAME = 'cashpilot-v7.3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './files/icon-192.png',
  './files/icon-512.png',
  './files/icon-192-maskable.png',
  './files/icon-512-maskable.png',
  './src/main.js',
  './src/core/constants.js',
  './src/core/state.js',
  './src/core/utils.js',
  './src/storage/db.js',
  './src/services/finance.js',
  './src/services/demo.js',
  './src/services/backup.js',
  './src/services/print.js',
  './src/ui/toast.js',
  './src/ui/modal.js',
  './src/ui/nav.js',
  './src/ui/components.js',
  './src/charts/chartConfig.js',
  './src/charts/charts.js',
  './src/pages/dashboard.js',
  './src/pages/income.js',
  './src/pages/expenses.js',
  './src/pages/debts.js',
  './src/pages/investments.js',
  './src/pages/budget.js',
  './src/pages/analytics.js',
  './src/pages/transactions.js',
  './src/services/notifications.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap'
];

/* ── تثبيت Service Worker وتخزين الأصول ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets...');
      return cache.addAll(STATIC_ASSETS.map(url => {
        return new Request(url, { mode: 'no-cors' });
      })).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── تفعيل Worker وحذف الكاش القديم ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* ── استراتيجية Cache First مع Fallback ── */
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات chrome-extension وغيرها
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // تحديث الكاش في الخلفية
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // محاولة جلب من الشبكة
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback للملفات الرئيسية
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ── استقبال رسائل من التطبيق ── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  // إرسال إشعار أصلي من خلال الـ Service Worker
  if (event.data && event.data.type === 'SEND_NOTIFICATION') {
    const { title, body, tag, link } = event.data;
    self.registration.showNotification(title, {
      body:    body || '',
      icon:    './files/icon-192.png',
      badge:   './files/icon-192-maskable.png',
      tag:     tag  || 'cashpilot-notif',
      data:    { link: link || null },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    }).catch(err => console.warn('[SW] showNotification failed:', err));
  }
});

/* ── عند النقر على الإشعار من شريط الإشعارات ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetLink = event.notification.data?.link || null;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // إذا كان التطبيق مفتوحاً → أعد التركيز عليه
      for (const client of clientList) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          client.focus();
          if (targetLink) client.postMessage({ type: 'NAVIGATE_TO', page: targetLink });
          return;
        }
      }
      // إذا لم يكن مفتوحاً → افتح نافذة جديدة
      return clients.openWindow('./' + (targetLink ? '#' + targetLink : ''));
    })
  );
});
