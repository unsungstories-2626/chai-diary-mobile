const CACHE='chai-diary-v1';
const ASSETS=['./','./index.html','./style.css','./app.js','./core.js','./cloud.js','./firebase-config.js','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('chai-diary-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET')return;
  // Never cache auth, API requests, or private diary data in the service worker.
  if(url.origin===location.origin&&url.pathname.startsWith(new URL('./',self.location).pathname)){
    const path=url.pathname.split('/').pop();
    if(!['','index.html','style.css','app.js','core.js','cloud.js','firebase-config.js','manifest.json','icon-192.png','icon-512.png'].includes(path))return;
    event.respondWith(fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));}return r;}).catch(()=>caches.match(event.request).then(r=>r|| (event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
  } else if(url.origin==='https://www.gstatic.com'&&url.pathname.startsWith('/firebasejs/10.14.1/')){
    event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));}return r;})));
  }
});
