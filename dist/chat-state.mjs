const active=job=>['queued','running','waiting'].includes(job.status);

export function chatJobPresentation(jobs,conversationId,connection={}){
 const own=jobs.filter(job=>(job.conversationId||job.agentId)===conversationId);
 const pending=own.filter(active);
 // New work replaces old failure banners. A slow task alone is not a failure.
 const problem=pending.find(job=>job.status==='running'&&job.error&&!job.recovering);
 const latest=own.at(-1);
 const disconnected=pending.length&&connection.ready===false&&connection.error?pending.at(-1):null;
 const failed=problem||disconnected||(!pending.length&&(latest?.status==='failed'||latest?.status==='interrupted'&&latest.error&&!latest.cancelRequested)?latest:null);
 if(failed)return {kind:'failed',label:'O agente encontrou um problema ao responder.',agentId:failed.agentId,error:disconnected?connection.error:failed.error||'',recoverable:jobs.some(job=>job.agentId===failed.agentId&&active(job))};
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
