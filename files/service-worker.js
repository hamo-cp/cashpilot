/* ============================================================
   Service Worker — ميزانيتي PWA
   يتيح العمل الكامل بدون اتصال إنترنت
   ============================================================ */

const CACHE_NAME = 'cashpilot-v2.1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
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
});
