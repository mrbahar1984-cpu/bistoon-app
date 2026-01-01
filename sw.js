
// BaharTime Service Worker
// این فایل مسئول مدیریت اعلان‌ها در زمانی است که مرورگر بسته است.

const CACHE_NAME = 'bahartime-v1';

self.addEventListener('install', (event) => {
  console.log('SW: Installing Service Worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activated');
  event.waitUntil(clients.claim());
});

// گوش دادن به پیام‌های ارسالی از سمت سرور
self.addEventListener('push', (event) => {
  console.log('SW: Push Received');
  
  let data = { title: 'اعلان جدید', body: 'درخواستی در BaharTime ثبت شد.' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'BaharTime', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: 'https://img.icons8.com/emoji/96/cherry-blossom.png',
    badge: 'https://img.icons8.com/emoji/48/cherry-blossom.png',
    dir: 'rtl',
    lang: 'fa-IR',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// مدیریت کلیک روی اعلان
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // اگر سایت باز بود، به همان تب برو
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // در غیر این صورت سایت را باز کن
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
