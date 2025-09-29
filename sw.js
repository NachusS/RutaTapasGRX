// Service Worker v6.2 (cache estático + datos + precache remoto opcional)
const CACHE_NAME = 'tapas-route-v6-2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/stops.json',
  './data/remote_photos.json',
  // Assets locales (fachadas y tapas); añade aquí si quieres forzar precache inicial
  './assets/cover.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k)))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('/data/stops.json')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return resp;
      }).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
    );
  }
});

// PRE-CACHE REMOTE PHOTOS (optional)
self.addEventListener('message', (e)=>{
  if(e.data && e.data.type === 'PRECACHE_REMOTE_PHOTOS'){
    const urls = e.data.urls || [];
    caches.open(CACHE_NAME).then(cache => {
      urls.forEach(u => { try{ cache.add(u); }catch{} });
    });
  }
});
