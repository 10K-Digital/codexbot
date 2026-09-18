import {translate,supportedLanguages} from './dist/i18n.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import webpush from 'web-push';
export function validSubscription(s){
 try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com'].includes(u.hostname)||u.hostname.endsWith('.push.apple.com')||u.hostname==='web.push.apple.com')&&u.href.length<4096&&/^[\w-]{87}$/.test(s.keys.p256dh)&&/^[\w-]{22}$/.test(s.keys.auth);}catch{return false;}
}
export function createPush({directory,subject,state,send=webpush.sendNotification.bind(webpush),now=()=>Date.now()}){
 const file=path.join(directory,'push.json');
 const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{vapid:webpush.generateVAPIDKeys(),subscriptions:[],reads:{}};
 const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);};save();
 const options={vapidDetails:{subject,publicKey:data.vapid.publicKey,privateKey:data.vapid.privateKey},TTL:3600,timeout:10000};
 function subscribe(subscription){if(!validSubscription(subscription))throw Error('Serviço de notificações não reconhecido.');const id=createHash('sha256').update(subscription.endpoint).digest('hex');let entry=data.subscriptions.find(s=>s.id===id);if(!entry){if(data.subscriptions.length>=30)throw Error('Limite de dispositivos atingido.');entry={id,subscription,since:now(),sent:[]};data.subscriptions.push(entry);}else entry.subscription=subscription;entry.language=supportedLanguages.includes(subscription.language)?subscription.language:'pt';save();return {id};}
 function remove(endpoint){data.subscriptions=data.subscriptions.filter(s=>s.subscription.endpoint!==endpoint);save();}
 function read(conversationId,through){if(typeof conversationId!=='string'||conversationId.length>160)throw Error('Conversa inválida.');const time=Date.parse(through);if(!Number.isFinite(time)||time>now()+5000)throw Error('Data inválida.');data.reads[conversationId]=Math.max(data.reads[conversationId]||0,Math.min(time,now()));save();}
 let busy=false;
 async function tick(approvals,agents){if(busy)return;busy=true;try{
 const events=[];
 for(const m of state.messages){if(m.role!=='assistant'||m.streaming||!m.text)continue;const job=state.jobs.find(j=>j.id===m.jobId);if(job?.a2a||job?.status!=='completed')continue;const conversation= m.conversationId||m.agentId,time=Date.parse(job.finishedAt||m.createdAt);if(time<= (data.reads[conversation]||0)||now()-time<6000)continue;events.push({id:m.id,time,conversation,agentId:m.agentId,type:'reply'});}
 for(const a of approvals){const job=state.jobs.find(j=>j.agentId===a.agentId&&j.status==='waiting');events.push({id:a.id,time:Date.parse(a.createdAt),conversation:job?.conversationId||a.agentId,agentId:a.agentId,type:'approval'});}
 for(const entry of [...data.subscriptions]){if(entry.retryAt>now())continue;const candidates=events.filter(e=>(e.type==='approval'||e.time>=entry.since)&&!entry.sent.includes(e.id));for(const event of candidates.slice(-8)){
 const tr=(key,params)=>translate(key,entry.language||'pt',params);const name=agents.find(a=>a.id===event.agentId)?.name||tr('Sua equipe');const payload={title:event.type==='approval'?tr('Aprovação pendente'):tr('{name} respondeu',{name}),body:event.type==='approval'?tr('{name} precisa da sua revisão.',{name}):tr('Há uma resposta não lida na sua equipe.'),tag:event.type+':'+event.conversation,conversation:event.conversation,badge:events.length};
 try{await send(entry.subscription,JSON.stringify(payload),options);entry.sent.push(event.id);entry.sent=entry.sent.slice(-2000);entry.lastSuccess=new Date(now()).toISOString();delete entry.lastError;delete entry.retryAt;entry.failures=0;save();}catch(e){entry.lastError='Não foi possível entregar a notificação.';entry.failures=(entry.failures||0)+1;entry.retryAt=now()+Math.min(3600000,15000*2**Math.min(entry.failures,8));if([404,410].includes(e.statusCode))remove(entry.subscription.endpoint);else save();break;}
 }}
 }finally{busy=false;}}
 return {subscribe,remove,read,tick,publicKey:data.vapid.publicKey,status:()=>({devices:data.subscriptions.length})};
}
