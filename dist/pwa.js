import {t,locale,currentLanguage,storedPreference,detectLanguage,browserLanguages,translateStatic} from './i18n.mjs';
export function setupPWA({api,el,button,toast,select,remote,openDialog,dialogBusy=()=>false}){
 let installEvent=null,registration=null,registrationError='';
 const standalone=()=>matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;
 addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;});
 const ready='serviceWorker' in navigator&&isSecureContext?navigator.serviceWorker.register('/sw.js').then(r=>{registration=r;return navigator.serviceWorker.ready;}).catch(()=>{registrationError=t('Não foi possível preparar a instalação. Atualize a página.');}):Promise.resolve();
 navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='open-conversation')select(event.data.conversation);});
 async function panel(box){
 box.append(el('h3',{},t('Instalar e receber novidades')));
 if(standalone())box.append(el('p',{},t('O Codexbot já está aberta como aplicativo.')));
 else if(installEvent)box.append(button(t('Instalar Codexbot'),async()=>{await installEvent.prompt();await installEvent.userChoice;installEvent=null;}));
 else box.append(el('p',{},t('No iPhone: abra no Safari, toque em Compartilhar → Adicionar à Tela de Início. No Android: abra o menu do Chrome → Instalar aplicativo.')));
 if(location.hostname.endsWith('.chatgpt.site'))box.append(el('a',{href:remote,target:'_blank',rel:'noopener'},t('Recomendado: instalar pelo endereço privado do Mac')));
 await ready;
 if(registrationError){box.append(el('p',{},registrationError));return;}
 if(!registration||!('PushManager' in window)||!('Notification' in window)){box.append(el('p',{},t('Para notificações no iPhone, adicione à Tela de Início e abra pelo ícone. Requer iOS 16.4 ou posterior.')));return;}
 let subscription=await registration.pushManager.getSubscription();
 const status=el('p',{},subscription?t('Notificações ativadas neste dispositivo.'):t('Receba avisos de respostas não lidas e aprovações pendentes, mesmo com o app fechado.'));box.append(status);
 const control=button(subscription?t('Desativar notificações'):t('Ativar notificações'),async()=>{
 if(subscription){await api('push/unsubscribe',{endpoint:subscription.endpoint});await subscription.unsubscribe();subscription=null;status.textContent=t('Notificações desativadas neste dispositivo.');control.textContent=t('Ativar notificações');return;}
 const permission=await Notification.requestPermission();if(permission!=='granted'){status.textContent=t('Permissão não concedida. Você pode alterar isso nas configurações do navegador.');return;}
 const {publicKey}=await api('push/config');const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const created=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 try{await api('push/subscribe',{...created.toJSON(),language:currentLanguage()});subscription=created;}catch(e){await created.unsubscribe();throw e;}
 status.textContent=t('Notificações ativadas neste dispositivo.');control.textContent=t('Desativar notificações');toast('Pronto. Avisaremos quando houver novidades.');
 });box.append(control,el('p',{class:'muted'},t('O Mac precisa estar ligado e conectado para enviar os avisos. O conteúdo das conversas não aparece na notificação.')));
 }
 let lastRead='';
 async function read(conversationId,through){if(document.hidden||!document.hasFocus()||!through)return;const key=conversationId+through;if(lastRead===key)return;try{await api('push/read',{conversationId,through});lastRead=key;const r=await ready;if(r){for(const n of await r.getNotifications())if(n.data?.conversation===conversationId)n.close();}}catch{}}
 function badge(count){if(navigator.setAppBadge){if(count)navigator.setAppBadge(count).catch(()=>{});else navigator.clearAppBadge().catch(()=>{});}}
 async function syncLanguage(){try{const r=await ready;if(!r)return;const subscription=await r.pushManager.getSubscription();if(subscription)await Promise.race([api('push/subscribe',{...subscription.toJSON(),language:currentLanguage()}),new Promise(resolve=>setTimeout(resolve,1500))]);}catch{}}
 void syncLanguage();
 function instructions(){
 const box=el('div',{class:'install-help'});openDialog(t('Codexbot no seu celular'),box);
 const preference=el('label',{class:'install-dismiss'}),check=el('input',{type:'checkbox'});
 try{check.checked=localStorage.getItem('codexbot-install-dismissed')==='1';}catch{}
 check.onchange=()=>{try{if(check.checked)localStorage.setItem('codexbot-install-dismissed','1');else localStorage.removeItem('codexbot-install-dismissed');}catch{}};
 preference.append(check,el('span',{},t('Não mostre novamente')));
 const content=el('div');box.append(content,preference);void panel(content).catch(e=>toast(e.message));
 }
 let timer=null,shown=false;
 function remind(){if(shown||document.hidden||dialogBusy())return;let dismissed=false;try{dismissed=localStorage.getItem('codexbot-install-dismissed')==='1';}catch{}
 if(dismissed||!matchMedia('(max-width: 1024px) and (pointer: coarse)').matches)return;
 if(standalone()&&typeof Notification!=='undefined'&&Notification.permission==='granted')return;
 shown=true;instructions();}
 timer=setTimeout(remind,5000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!shown){clearTimeout(timer);timer=setTimeout(remind,5000);}});
 document.addEventListener('close',()=>{if(!shown){clearTimeout(timer);timer=setTimeout(remind,5000);}},true);
 return {panel,read,badge,syncLanguage,instructions};
}
