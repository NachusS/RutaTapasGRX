const CACHE_NAME='tapas-route-v6-2';const ASSETS=['./','./index.html','./styles.css','./app.js','./data/stops.json','./data/remote_photos.json','./assets/cover.jpg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>(k===CACHE_NAME?null:caches.delete(k))))))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.pathname.endsWith('/data/stops.json')){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE_NAME).then(C=>C.put(e.request,c));return r}).catch(()=>caches.match(e.request)))}else{e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).catch(()=>c)))}});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='PRECACHE_REMOTE_PHOTOS'){const urls=e.data.urls||[];caches.open(CACHE_NAME).then(C=>{urls.forEach(u=>{try{C.add(u)}catch{}})})}});
