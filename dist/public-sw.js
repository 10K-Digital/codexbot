/* Cache only generic offline artwork and fallback HTML, never authenticated responses. */
const CACHE='equipe-shell-v38';
const SHELL=['/offline.html','/boot.css','/boot.js','/mascot.svg','/mascot-crying.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const path of SHELL){const response=await fetch(path,{cache:'reload'});if(!response.ok||response.redirected)throw Error('Offline asset unavailable');await cache.put(path,response);}
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('equipe-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(SHELL.includes(url.pathname)&&!url.search){event.respondWith(caches.match(url.pathname).then(cached=>cached||fetch(event.request)));return;}
 if(event.request.mode==='navigate'&&url.pathname==='/')event.respondWith(fetch(event.request).then(response=>response.status>=500?caches.match('/offline.html'):response).catch(()=>caches.match('/offline.html')));
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
