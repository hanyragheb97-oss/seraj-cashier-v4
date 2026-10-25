// قم بتغيير اسم الإصدار (v2) لتحديث الكاش القديم عند المستخدمين
const CACHE_NAME = 'seraj-test-isolated-v20';

const urlsToCache = [
  '/', '/index.html', '/store.html', '/purchases.html', '/purchases_history.html',
  '/sales.html', '/sales_history.html', '/suppliers.html', '/customers.html',
  '/treasury.html', '/smart_accountant.html', '/db.js', '/ai_brain.js', '/manifest.json',
  '/store.jpg', '/buy.jpg', '/sales.jpg', '/suppliers.jpg', '/customers.jpg', '/safe.jpg', '/ai.jpg',
  '/purchases_detailed.html', '/purchases_summary.html', '/purchases_unpaid.html', '/purchases_all.html',
  '/sales_detailed.html', '/sales_summary.html', '/sales_unpaid.html', '/sales_all.html',
  '/supplier_invoices.html', '/supplier_products.html', '/suppliers_debt.html',
  '/customer_invoices.html', '/customer_products.html', '/customers_debt.html',
  '/treasury_movement.html', '/inventory_detailed.html', '/inventory_summary.html', '/inventory_price_history.html',
  '/expenses_detailed.html', '/expenses_summary.html', '/profit_detailed.html', '/profit_summary.html', '/profit_margin.html'
];

// 1. مرحلة التثبيت وتخزين الملفات
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // تخزين الملفات بأمان دون إيقاف العملية إذا فشل ملف واحد
            for (const url of urlsToCache) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response);
                    }
                } catch (err) {
                    console.warn('تخطي الملف غير الموجود:', url);
                }
            }
        })
    );
});

// 2. تنشيط النسخة ومسح الكاش القديم فوراً
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

// 3. إدارة الطلبات (السرعة الفائقة + الاستقرار أونلاين وأوفلاين)
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // 🚨 استثناء طلبات قواعد البيانات والذكاء الاصطناعي وطلبات POST/PUT
    if (request.method !== 'GET' || 
        url.hostname.includes('firestore') || 
        url.hostname.includes('firebase') || 
        url.hostname.includes('googleapis') || 
        url.hostname.includes('identitytoolkit')) {
        return; // تركها تمر مباشرة للشبكة بدون تدخل الـ Service Worker
    }

    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
            // تحديث الكاش في الخلفية لو النت شغال
            const fetchPromise = fetch(request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
                }
                return networkResponse;
            }).catch(() => {
                // فشل النت في الخلفية، لا حاجة لإظهار خطأ طالما الرد مأخوذ من الكاش
            });

            // ⚡ إذا كان الملف موجود في الكاش نرجعه فوراً (سرعة 0ms وبدون انتظار النت)
            // إذا لم يكن موجوداً، ننتظر تحميله من النت
            return cachedResponse || fetchPromise.catch(() => {
                // إذا كان المستخدم يطلب صفحة HTML والنت فاصل تماماً ومش متخزنة
                if (request.headers.get('accept')?.includes('text/html') || request.mode === 'navigate') {
                    return caches.match('/index.html', { ignoreSearch: true });
                }
            });
        })
    );
});
