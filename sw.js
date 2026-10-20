const CACHE = 'tablero-v4'; // sube el número al publicar cambios
const SHELL = [
  './', './index.html', './app.js', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).hostname === 'api.anthropic.com') return; // la API nunca se cachea
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});

/* ---------- Almacén mínimo en IndexedDB (el SW no ve LocalStorage) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('tablero', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function idbSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

/* ---------- Notificaciones locales por bloque ---------- */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE') event.waitUntil(idbSet('schedule', event.data));
});

async function checkBlocks() {
  const s = await idbGet('schedule');
  if (!s || !s.enabled || !s.blocks) return;
  const now = new Date(), dia = now.toLocaleDateString('en-CA');
  if (s.dia !== dia) return;
  let notified = (await idbGet('notified')) || {};
  if (notified.dia !== dia) notified = { dia, list: [] };
  const min = now.getHours() * 60 + now.getMinutes();
  for (const b of s.blocks) {
    const [h, m] = b.hhmm.split(':').map(Number);
    const diff = min - (h * 60 + m), tag = `${dia}-${b.hhmm}`;
    if (diff >= 0 && diff <= 15 && !notified.list.includes(tag)) {
      notified.list.push(tag);
      await self.registration.showNotification(b.title, { body: b.body, tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './index.html?tab=hoy' } });
    }
  }
  await idbSet('notified', notified);
}

// Mejor esfuerzo: solo Chrome en Android con la app instalada, sin hora exacta
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-blocks') event.waitUntil(checkBlocks());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return clients.openWindow(url);
    })
  );
});
