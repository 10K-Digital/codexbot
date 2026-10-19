import {validTimezone,detectedTimezone,legacyTimezone} from './dist/timezone.mjs';
import {validCron,safeText,scheduleSlot} from './lib.mjs';
import {scheduleToCron,routineSchedule,describeRoutine,onceDate} from './dist/schedule.mjs';
export const routineTools=[
 {type:'function',name:'team_list_routines',description:'Lista rotinas e tarefas agendadas do proprietário, IDs, instruções, frequência e estado ativo/pausado. Não executa tarefas.',inputSchema:{type:'object',properties:{agentId:{type:'string'}},additionalProperties:false}},
 {type:'function',name:'team_update_routine',description:'Ativa, pausa ou edita uma rotina existente quando solicitado pelo usuário. Pausar impede futuras execuções; não cancela a tarefa já iniciada. Não disponível para clientes externos. Use team_list_routines para obter o ID. team_list_routines retorna timezone da agenda atual e defaultTimezone do proprietário. Novos agendamentos usam automaticamente o fuso do proprietário.',inputSchema:{type:'object',properties:{id:{type:'string'},enabled:{type:'boolean'},timezone:{type:'string',description:'Fuso IANA opcional; por padrão usa o fuso detectado do proprietário.'},prompt:{type:'string'},schedule:{type:'object',properties:{at:{type:'string',description:'Data e horário ISO 8601 com fuso, obrigatório para once; exemplo 2027-01-20T09:00:00-03:00'},kind:{type:'string',enum:['weekly','interval','monthly','once']},days:{type:'array',items:{type:'integer',minimum:0,maximum:6}},hours:{type:'array',items:{type:'integer',minimum:0,maximum:23}},minute:{type:'integer',minimum:0,maximum:59},day:{type:'integer',minimum:1,maximum:31},start:{type:'integer',minimum:0,maximum:23},end:{type:'integer',minimum:0,maximum:23},every:{type:'integer',minimum:1,maximum:23}},required:['kind'],additionalProperties:false}},required:['id'],additionalProperties:false}}
];
export function createRoutines({state,persist,feedback,hasFeedbackAgent=()=>true,enqueue,onError=()=>{},now=()=>Date.now()}){
 let migrated=false;if(!state.timezone){state.timezone=detectedTimezone();migrated=true;}for(const r of state.routines)if(!r.timezone){r.timezone=legacyTimezone;migrated=true;}if(migrated)persist();
 const nativeId='codexbot-feedback-review';
 const view=r=>({...r,schedule:routineSchedule(r),frequency:describeRoutine(r),defaultTimezone:state.timezone,timezone:r.timezone||state.timezone});
 function list({agentId}={}){const result=state.routines.map(view);if(feedback&&hasFeedbackAgent())result.push({id:nativeId,agentId:'general-manager',name:'Revisão semanal de feedbacks',enabled:feedback.publicState().settings.enabled,cron:'0 9 * * 1',frequency:'Seg · 09:00',timezone:feedback.publicState().timezone||state.timezone,editableFields:['enabled']});return result.filter(r=>!agentId||r.agentId===agentId);}
 function update(b){
  if(typeof b.id!=='string'||!['enabled','prompt','schedule','cron'].some(k=>b[k]!==undefined))throw Error('Informe a rotina e a alteração.');
  if(b.enabled!==undefined&&typeof b.enabled!=='boolean')throw Error('Estado inválido.');
  if(b.id===nativeId&&feedback){if(b.prompt!==undefined||b.schedule!==undefined||b.cron!==undefined)throw Error('A revisão nativa permite apenas ativar ou pausar.');const settings=feedback.publicState().settings;feedback.settings({...settings,enabled:b.enabled});return list().find(r=>r.id===nativeId);}
  const r=state.routines.find(r=>r.id===b.id);if(!r)throw Error('Rotina desconhecida.');const next={...r};if(b.schedule!==undefined||b.cron!==undefined)next.timezone=validTimezone(b.timezone===undefined?state.timezone:b.timezone);else if(b.timezone!==undefined)throw Error('Defina a agenda ao alterar o fuso horário.');
  if(b.cron!==undefined){if(typeof b.cron!=='string'||!validCron(b.cron))throw Error('Expressão de agenda inválida.');next.cron=b.cron;delete next.schedule;delete next.dispatchedAt;}
  if(b.schedule!==undefined){if(b.schedule?.kind==='once'){next.schedule={kind:'once',at:onceDate(b.schedule.at,{future:true,now:now()})};next.cron=null;}else{next.cron=scheduleToCron(b.schedule);delete next.schedule;}delete next.dispatchedAt;}
  if(b.prompt!==undefined){next.prompt=safeText(b.prompt);if(r.sourceTruncated&&r.prompt.includes('Referência parcial da rotina original:')&&!next.prompt.includes('Referência parcial da rotina original:')){next.instructionsReviewedAt=new Date().toISOString();next.migrationNote='Instruções revisadas para o Codexbot. Confirme as dependências antes de ativar; evite duplicar rotinas em outros sistemas.';}}
  if(b.enabled!==undefined)next.enabled=b.enabled;
  if(next.enabled&&next.schedule?.kind==='once'){if(next.dispatchedAt)throw Error('Esta rotina já foi disparada. Escolha uma nova data para agendar novamente.');if(b.enabled===true)onceDate(next.schedule.at,{future:true,now:now()});}
  for(const key of ['schedule','dispatchedAt'])if(!(key in next))delete r[key];Object.assign(r,next);persist();return {...view(r),running:state.jobs.some(j=>j.routineId===r.id&&['queued','running','waiting'].includes(j.status))};
 }
 function remove({id}){
  if(id===nativeId)throw Error('A rotina nativa não pode ser excluída. Você pode pausá-la.');
  const routine=state.routines.find(r=>r.id===id);if(!routine)throw Error('Rotina desconhecida.');
  state.deletedRoutines??=[];state.deletedRoutines.push({...routine,deletedAt:new Date(now()).toISOString()});
  state.routines=state.routines.filter(r=>r.id!==id);if(state.scheduleSlots)delete state.scheduleSlots[id];persist();return {ok:true};
 }
 function call(job,name,args){if(!job||job.a2a||job.feedbackReview)throw Error('Rotinas disponíveis apenas nas tarefas do proprietário.');if(name==='team_list_routines')return list(args);if(name==='team_update_routine')return update(args);throw Error('Ferramenta desconhecida.');}
 function tick(){
  for(const r of state.routines){
   if(!r.enabled)continue;
   const once=r.schedule?.kind==='once';
   if(once&&(r.dispatchedAt||Date.parse(r.schedule.at)>now()||!Number.isFinite(Date.parse(r.schedule.at))))continue;
   const slot=once?'once:'+r.schedule.at:scheduleSlot(r.cron,new Date(now()),r.timezone||state.timezone);
   state.scheduleSlots??={};
   if(!slot||(!once&&state.scheduleSlots[r.id]===slot)||state.jobs.some(j=>j.routineId===r.id&&['queued','running','waiting'].includes(j.status)))continue;
   const previous=state.scheduleSlots[r.id];state.scheduleSlots[r.id]=slot;
   if(once){r.enabled=false;r.dispatchedAt=new Date(now()).toISOString();}
   try{enqueue(r.agentId,r.prompt,{from:'Rotina: '+r.name,routineId:r.id});persist();}
   catch(e){if(once){r.enabled=true;delete r.dispatchedAt;state.scheduleSlots[r.id]=previous;}persist();onError(r,e);}
  }
 }
 function setTimezone(value){const zone=validTimezone(value);if(state.timezone!==zone){state.timezone=zone;persist();}return {timezone:state.timezone};}
 return {list,update,remove,call,tick,setTimezone};
}
