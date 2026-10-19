export function connectionState(previous,{ok,status=0,now=Date.now()}) {
 if(ok)return {failures:0,since:null,phase:'connected'};
 const failures=(previous.failures||0)+1,since=previous.since??now;
 return {failures,since,phase:status===401||status===403?'unauthorized':failures>=3&&now-since>=15000?'offline':'reconnecting'};
}

export function attention(state,id,seen={},includeThreads=false) {
 const conversation=item=>item.conversationId||item.agentId;
 const belongs=item=>conversation(item)===id||(includeThreads&&item.agentId===id&&conversation(item)?.startsWith('thread:'));
 const messages=state.messages.filter(m=>belongs(m)&&['assistant','agent'].includes(m.role)&&!m.streaming&&!m.superseded);
 const pendingCards=messages.filter(m=>m.card?.actions?.length&&!m.card.response);
 const unread=messages.filter(m=>!pendingCards.includes(m)&&Math.max(Date.parse(m.createdAt)||0,Date.parse(state.jobs.find(j=>j.id===m.jobId)?.finishedAt)||0)>(Date.parse(seen[conversation(m)])||0)).length;
 const approvals=state.approvals.filter(r=>{const job=state.jobs.find(j=>j.id===r.jobId)||state.jobs.find(j=>j.agentId===r.agentId&&j.status==='waiting');return belongs({...r,conversationId:job?.conversationId||r.conversationId});});
 const waiting=state.jobs.filter(j=>belongs(j)&&j.status==='waiting'&&!j.resumeQueued&&!approvals.some(r=>r.jobId===j.id||!r.jobId&&r.agentId===j.agentId)&&!pendingCards.some(m=>m.jobId===j.id));
 const tasks=pendingCards.length+waiting.length;
 return {unread,approvals:approvals.length,tasks,total:unread+approvals.length+tasks};
}
export function createAgentPresence(){
 let previous=null,jobs=[];const celebrations=new Map();
 return {update(next,now=Date.now()){
  if(previous)for(const job of next)if(job.status==='completed'&&previous.get(job.id)!=='completed'){
   for(const id of new Set([job.agentId,job.conversationId||job.agentId]))celebrations.set(id,{token:job.id,until:now+1000});
  }
  previous=new Map(next.map(j=>[j.id,j.status]));jobs=next;
 },get(id,now=Date.now()){const celebration=celebrations.get(id);return {working:jobs.some(j=>(j.agentId===id||(j.conversationId||j.agentId)===id)&&['running','queued'].includes(j.status)),celebration:celebration?.until>now?celebration.token:null};}};
}
export function paintPresence(node,id,presence){
 const {working,celebration}=presence.get(id);paintAvatar(node,id,working);
 if(celebration&&node.dataset.celebration!==celebration){node.dataset.celebration=celebration;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)node.animate([{transform:'translateY(0) scale(1)'},{transform:'translateY(2px) scale(1.06,.9)',offset:.2},{transform:'translateY(-9px) scale(.96,1.04)',offset:.5},{transform:'translateY(0) scale(1.05,.95)',offset:.8},{transform:'translateY(0) scale(1)'}],{duration:650,easing:'ease-in-out'});}
}
export function avatarSeed(id){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash>>>0;}
let avatarInstance=0;
export function paintAvatar(node,id,working=false){
 const seed=avatarSeed(id);node.classList.add('character-avatar');node.classList.toggle('working',working);
 if(node.dataset.character===id)return;node.dataset.character=id;
 const colors=['#9bc7b1','#e7b975','#b7a9d8','#89bfcf','#e6a79d','#c4c982','#9fb5dd'];const color=colors[seed%colors.length];
 const shapes=['M10 22Q10 10 23 10H41Q54 10 54 23V43Q54 54 42 54H22Q10 54 10 42Z','M32 8C48 8 57 20 55 36S44 57 29 55 7 44 9 29 18 8 32 8Z','M20 10H44L57 32 45 54H19L7 32Z','M15 12Q32 4 49 12L55 42Q51 57 32 55 13 57 9 42Z','M11 24Q9 10 23 13L32 7 41 13Q55 10 53 24L57 37Q54 55 32 55 10 55 7 37Z'];
 const ns='http://www.w3.org/2000/svg',make=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const svg=make('svg',{viewBox:'0 0 64 64','aria-hidden':'true',class:'character-art'});const gradientId='avatar-gradient-'+(++avatarInstance),defs=make('defs',{}),gradient=make('linearGradient',{id:gradientId,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});gradient.append(make('stop',{offset:'0%','stop-color':color}),make('stop',{offset:'48%','stop-color':color}),make('stop',{offset:'100%','stop-color':'#41685d'}));defs.append(gradient);svg.append(defs,make('path',{class:'character-body',d:shapes[(seed>>>4)%shapes.length],fill:'url(#'+gradientId+')'}));
 const face=make('g',{class:'character-face',fill:'none',stroke:'#243b35','stroke-width':'2.7','stroke-linecap':'round'});
 const expression=(seed>>>8)%4;
 if(expression===0){face.append(make('path',{d:'M19 28q4-5 8 0M37 28q4-5 8 0'}));}else{face.append(make('ellipse',{cx:23,cy:28,rx:2.3,ry:expression===1?4:3,fill:'#243b35',stroke:'none'}));face.append(expression===2?make('path',{d:'m37 28 7-2'}):make('ellipse',{cx:41,cy:28,rx:2.3,ry:3,fill:'#243b35',stroke:'none'}));}
 face.append(make('path',{d:['M24 38q8 9 16 0','M26 39q6 4 12-1','M25 38q8 8 15-1','M27 38h10q0 7-5 7t-5-7'][(seed>>>12)%4]}));
 if((seed>>>16)%3===0)face.append(make('path',{d:'M16 23h14v11H16ZM34 23h14v11H34ZM30 27h4','stroke-width':'1.5'}));
 svg.append(face);node.replaceChildren(svg);
}

const activeChatJob=job=>['queued','running','waiting'].includes(job.status);

export function chatJobPresentation(jobs,conversationId,connection={}){
 const own=jobs.filter(job=>(job.conversationId||job.agentId)===conversationId);
 const pending=own.filter(activeChatJob);
 // New work replaces old failure banners. A slow task alone is not a failure.
 const problem=pending.find(job=>job.status==='running'&&job.error&&!job.recovering);
 const latest=own.at(-1);
 const interrupted=own.findLast(job=>job.status==='interrupted'&&job.error&&!job.cancelRequested&&pending.some(next=>job.finishedAt&&next.createdAt&&job.finishedAt>=next.createdAt));
 const blockedQueue=pending.length&&pending.every(job=>job.status==='queued')&&!jobs.some(job=>job.status==='running')&&interrupted;
 const disconnected=pending.length&&connection.ready===false&&(connection.error||blockedQueue)?pending.at(-1):null;
 const failed=problem||disconnected||(!pending.length&&(latest?.status==='failed'||latest?.status==='interrupted'&&latest.error&&!latest.cancelRequested)?latest:null);
 if(failed)return {kind:'failed',label:'O agente encontrou um problema ao responder.',agentId:failed.agentId,error:disconnected?(connection.error||interrupted?.error||''):failed.error||'',recoverable:jobs.some(job=>job.agentId===failed.agentId&&activeChatJob(job))};
 if(!pending.length)return null;
 const review=pending.find(job=>job.status==='waiting'&&!job.resumeQueued);
 if(review)return {kind:'review',label:'Aguardando sua revisão',agentId:review.agentId};
 const current=pending.at(-1);
 const blocker=jobs.find(job=>job.agentId===current.agentId&&job.status==='waiting'&&!job.resumeQueued&&!job.a2a);
 if(blocker)return {kind:'review',label:'O agente aguarda sua revisão em outra conversa.',agentId:current.agentId,reviewConversationId:blocker.conversationId||blocker.agentId};
 return {kind:'thinking',label:'Pensando…',agentId:current.agentId};
}

export function renderChatJobState(view,{el,button,t,paintAvatar,recover,review,compose}){
 const row=el('div',{class:'job-state '+view.kind,role:'status','aria-live':'polite'});
 if(view.kind==='thinking'){const portrait=el('span',{class:'avatar in-view','aria-hidden':'true'});paintAvatar(portrait,view.agentId,true);row.append(portrait);}
 row.append(el('p',{},t(view.label)));
 if(view.kind==='failed'){
  if(view.error){const details=el('details');details.append(el('summary',{},t('Ver o que aconteceu')),el('p',{},t(view.error)));row.append(details);}
  row.append(view.recoverable?button(t('Destravar agente'),()=>recover(view.agentId),'secondary'):button(t('Nova mensagem'),()=>compose(),'secondary'));
 }
 if(view.reviewConversationId)row.append(button(t('Revisar tarefa pendente'),()=>review(view.reviewConversationId),'secondary'));
 return row;
}
