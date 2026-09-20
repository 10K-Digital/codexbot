/* Public access: no response cache, including after logout or session expiry. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('equipe-shell-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
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
