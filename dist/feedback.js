import {t,locale} from './i18n.mjs';
export function setupFeedback({api,el,button,iconButton,openDialog,toast,refresh,getState}){
 const close=()=>document.querySelector('#dialog').close();
 function actions(m){return [1,-1].map(rating=>{const saved=getState().feedback?.ratings?.[m.id];const b=iconButton(rating===1?'Gostei da resposta':'Não gostei da resposta',rating===1?'thumbsup':'thumbsdown',async()=>{
  const current=getState().feedback?.ratings?.[m.id];await api('feedback/rate',{messageId:m.id,rating,comment:current?.comment||''});await refresh();
  const box=el('div',{class:'feedback-form'}),field=el('textarea',{rows:'4',maxlength:'4000','aria-label':t('Comentário opcional'),placeholder:t('O que devemos manter ou melhorar?')});field.value=current?.comment||'';
  box.append(el('p',{},t('Avaliação salva. Você também pode deixar um comentário.')),field,button(t('Salvar feedback'),async()=>{await api('feedback/rate',{messageId:m.id,rating,comment:field.value});close();await refresh();toast('Feedback salvo.');},'primary'));
  openDialog(t('Comentário opcional'),box);field.focus();
 });b.setAttribute('aria-pressed',String(saved?.rating===rating));return b;});}
 async function center(){const data=await api('feedback'),box=el('div',{class:'feedback-center'});
  box.append(el('p',{},t('Segundas-feiras às 9h · São Paulo. A IA só é acionada se houver feedback novo.')),el('p',{class:'muted'},t('Próxima revisão: {date}',{date:new Date(data.nextReviewAt).toLocaleString(locale())})),el('p',{},t('Feedbacks não processados: {count}',{count:data.pendingCount})));
  const enabled=el('input',{type:'checkbox'}),auto=el('input',{type:'checkbox'});enabled.checked=data.settings.enabled;auto.checked=data.settings.autoApply;
  for(const [input,label]of [[enabled,'Revisão semanal ativa'],[auto,'Incorporar automaticamente sugestões pendentes e futuras']]){const row=el('label',{class:'feedback-toggle'});row.append(input,el('span',{},t(label)));box.append(row);}
  box.append(el('p',{class:'muted'},t('Por padrão, você aprova cada alteração. O modo automático adiciona instruções; conflitos exigem revisão manual.')),button(t('Salvar preferências'),async()=>{await api('feedback/settings',{enabled:enabled.checked,autoApply:auto.checked});await refresh();await center();toast('Preferências salvas.');}),button(t('Revisar agora'),async()=>{const r=await api('feedback/review',{});await refresh();await center();toast(r.started?'Revisão iniciada.':r.reason==='running'?'Revisão em andamento.':'Nenhum feedback novo. Nenhuma IA foi acionada.');}));
  if(data.batch)box.append(el('p',{role:'status'},t('Revisão em andamento.')));
  box.append(el('h3',{},t('Sugestões de melhoria')));
  if(!data.suggestions.length)box.append(el('p',{class:'muted'},t('As sugestões aparecerão aqui após a revisão.')));
  for(const s of [...data.suggestions].reverse()){const card=el('section',{class:'card feedback-suggestion'});card.append(el('h4',{},s.title),el('p',{class:'muted'},(getState().agents.find(a=>a.id===s.agentId)?.name||s.agentId)+' · '+t({pending:'Pendente',approved:'Aguardando aplicação',applied:'Incorporada',rejected:'Rejeitada'}[s.status])),el('p',{},s.rationale),el('pre',{},s.instruction));if(s.error)card.append(el('p',{role:'status'},t(s.error)));
   if(['pending','approved'].includes(s.status))card.append(button(t('Revisar e aprovar'),async()=>{const detail=await api('feedback/suggestion?id='+encodeURIComponent(s.id)),body=el('div');body.append(el('h3',{},t('Instruções atuais')),el('pre',{},detail.current),el('h3',{},t('Adicionar às instruções')),el('pre',{},detail.instruction),button(t('Aprovar alteração'),async()=>{await api('feedback/decision',{id:s.id,action:'approve',currentHash:detail.currentHash});await refresh();await center();},'primary'));openDialog(t('Revisar e aprovar'),body);}),button(t('Rejeitar'),async()=>{await api('feedback/decision',{id:s.id,action:'reject'});await refresh();await center();}));box.append(card);}
  if(data.reviews.length){const history=el('details');history.append(el('summary',{},t('Histórico de revisões')));for(const r of [...data.reviews].reverse()){history.append(el('p',{},new Date(r.at).toLocaleString(locale())+' · '+t(r.status==='completed'?'Concluída':'Revisão incompleta')));for(const d of r.dismissals||[])history.append(el('p',{class:'muted'},d.reason));}box.append(history);}
  openDialog(t('Feedbacks e melhorias'),box);
 }
 function routine(){const card=el('section',{class:'card'});card.append(el('h3',{},t('Revisão de feedbacks')),el('p',{},t('Segundas-feiras às 9h · São Paulo. A IA só é acionada se houver feedback novo.')),button(t('Feedbacks e melhorias'),center));return card;}
 return {actions,center,routine};
}
