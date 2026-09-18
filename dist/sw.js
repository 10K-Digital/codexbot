/* Only public application assets are cached. Credentials, files and conversations never enter this cache. */
const CACHE='equipe-shell-v11';
const SHELL=['/','/app.js','/cards.mjs','/connection.mjs','/pwa.js','/i18n.mjs','/translations.mjs','/style.css','/manifest.webmanifest','/manifest.pt.webmanifest','/manifest.en.webmanifest','/manifest.es.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('equipe-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!SHELL.includes(url.pathname)||url.search)return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok&&response.type!=='opaqueredirect') {const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data={};try{data=event.data.json();}catch{}
 const conversation=typeof data.conversation==='string'?data.conversation.slice(0,160):'';
 await self.registration.showNotification(data.title||'Equipe',{body:data.body||'Há novidades na sua equipe.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'equipe',data:{conversation}});
 if(self.navigator.setAppBadge)await self.navigator.setAppBadge(Math.max(1,Math.min(Number(data.badge)||1,999))).catch(()=>{});
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const conversation=event.notification.data?.conversation||'';const url=new URL('/#conversation='+encodeURIComponent(conversation),self.location.origin).href;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const current=windows.find(w=>new URL(w.url).origin===self.location.origin);
 if(current){current.postMessage({type:'open-conversation',conversation});await current.focus();}else await self.clients.openWindow(url);
})());});
