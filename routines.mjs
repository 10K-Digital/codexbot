import {validCron,safeText} from './lib.mjs';
import {scheduleToCron,cronToSchedule,describeSchedule} from './dist/schedule.mjs';
export const routineTools=[
 {type:'function',name:'team_list_routines',description:'Lista rotinas e tarefas agendadas do proprietário, IDs, instruções, frequência e estado ativo/pausado. Não executa tarefas.',inputSchema:{type:'object',properties:{agentId:{type:'string'}},additionalProperties:false}},
 {type:'function',name:'team_update_routine',description:'Ativa, pausa ou edita uma rotina existente quando solicitado pelo usuário. Pausar impede futuras execuções; não cancela a tarefa já iniciada. Não disponível para clientes externos. Use team_list_routines para obter o ID. Frequência no horário de São Paulo.',inputSchema:{type:'object',properties:{id:{type:'string'},enabled:{type:'boolean'},prompt:{type:'string'},schedule:{type:'object',properties:{kind:{type:'string',enum:['weekly','interval','monthly']},days:{type:'array',items:{type:'integer',minimum:0,maximum:6}},hours:{type:'array',items:{type:'integer',minimum:0,maximum:23}},minute:{type:'integer',minimum:0,maximum:59},day:{type:'integer',minimum:1,maximum:31},start:{type:'integer',minimum:0,maximum:23},end:{type:'integer',minimum:0,maximum:23},every:{type:'integer',minimum:1,maximum:23}},required:['kind','minute'],additionalProperties:false}},required:['id'],additionalProperties:false}}
];
export function createRoutines({state,persist,feedback}){
 const nativeId='codexbot-feedback-review';
 const view=r=>({...r,schedule:cronToSchedule(r.cron),frequency:describeSchedule(r.cron),timezone:'America/Sao_Paulo'});
 function list({agentId}={}){const result=state.routines.map(view);if(feedback)result.push({id:nativeId,agentId:'general-manager',name:'Revisão semanal de feedbacks',enabled:feedback.publicState().settings.enabled,cron:'0 9 * * 1',frequency:'Seg · 09:00',timezone:'America/Sao_Paulo',editableFields:['enabled']});return result.filter(r=>!agentId||r.agentId===agentId);}
 function update(b){
  if(typeof b.id!=='string'||!['enabled','prompt','schedule','cron'].some(k=>b[k]!==undefined))throw Error('Informe a rotina e a alteração.');
  if(b.enabled!==undefined&&typeof b.enabled!=='boolean')throw Error('Estado inválido.');
  if(b.id===nativeId&&feedback){if(b.prompt!==undefined||b.schedule!==undefined||b.cron!==undefined)throw Error('A revisão nativa permite apenas ativar ou pausar.');const settings=feedback.publicState().settings;feedback.settings({...settings,enabled:b.enabled});return list().find(r=>r.id===nativeId);}
  const r=state.routines.find(r=>r.id===b.id);if(!r)throw Error('Rotina desconhecida.');const next={...r};
  if(b.cron!==undefined){if(typeof b.cron!=='string'||!validCron(b.cron))throw Error('Expressão de agenda inválida.');next.cron=b.cron;}
  if(b.schedule!==undefined)next.cron=scheduleToCron(b.schedule);
  if(b.prompt!==undefined){next.prompt=safeText(b.prompt);if(r.sourceTruncated&&r.prompt.includes('Referência parcial da rotina original:')&&!next.prompt.includes('Referência parcial da rotina original:')){next.instructionsReviewedAt=new Date().toISOString();next.migrationNote='Instruções revisadas para o Codexbot. Confirme as dependências antes de ativar; evite duplicar rotinas em outros sistemas.';}}
  if(b.enabled!==undefined)next.enabled=b.enabled;
  Object.assign(r,next);persist();return {...view(r),running:state.jobs.some(j=>j.routineId===r.id&&['queued','running','waiting'].includes(j.status))};
 }
 function call(job,name,args){if(!job||job.a2a||job.feedbackReview)throw Error('Rotinas disponíveis apenas nas tarefas do proprietário.');if(name==='team_list_routines')return list(args);if(name==='team_update_routine')return update(args);throw Error('Ferramenta desconhecida.');}
 return {list,update,call};
}
