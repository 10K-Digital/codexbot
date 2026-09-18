import fs from 'node:fs';import path from 'node:path';
export const MAX_ATTEMPTS=3;
const ladder=[['gpt-5.6-luna','low'],['gpt-5.6-luna','medium'],['gpt-5.6-luna','high'],['gpt-5.6-luna','xhigh'],['gpt-5.6-luna','max'],['gpt-5.6-sol','high'],['gpt-6-astra','high'],['gpt-6-astra','max']];
export function classifyTask(job){
 const text=String(job.text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const advanced=/distributed systems|sistemas distribuidos|formal proof|prova formal|zero.day|race condition|concorrencia distribuida|criptografia|cryptograph|novel algorithm|algoritmo inedito/.test(text);
 const challenging=/arquitetura|architecture|refator|refactor|depur|debug|investig|migrac|migration|auditor|audit|otimiz|optimiz/.test(text);
 const multi=/implemente|implement|pesquise|research|analise|analy[sz]e|compare|integrac|integrat|codigo|code|testes|tests|relatorio|report/.test(text);
 const steps=(text.match(/(?:^|\n)\s*(?:\d+[.)]|[-*])\s/g)||[]).length;
 let level=1,reason='routine';
 if(advanced){level=6;reason='specialist';}else if(challenging&&(text.length>4000||steps>6)){level=5;reason='complex';}else if(challenging){level=4;reason='challenging';}else if(multi||steps>=3||text.length>2500||job.feedbackReview){level=2;reason='analysis';}else if(text.length<220&&!job.attachmentIds?.length){level=0;reason='simple';}
 if(job.attachmentIds?.length&&level<2){level=2;reason='attachments';}return {level,reason};
}
function available(models,pair){return models.some(m=>(m.model||m.id)===pair[0]&&(m.supportedReasoningEfforts||[]).some(e=>(e.reasoningEffort||e)===pair[1]));}
export function chooseRoute(job,models){
 const previous=job.attempts?.at(-1);let {level,reason}=classifyTask(job);
 if(previous){const current=ladder.findIndex(([m,e])=>m===previous.model&&e===previous.effort);level=current<0?5:current<2?2:current<4?4:current+1;reason='escalation';}
 for(let i=level;i<ladder.length;i++)if(available(models,ladder[i]))return {model:ladder[i][0],effort:ladder[i][1],level:i,reason};
 // Only first attempts may fall back to another advertised model/effort.
 if(!previous){for(const m of models.filter(m=>/luna|terra|sol|astra/.test(m.model||m.id))){const model=m.model||m.id,efforts=m.supportedReasoningEfforts||[];const effort=efforts.find(e=>(e.reasoningEffort||e)==='medium')||efforts[0];if(effort)return {model,effort:effort.reasoningEffort||effort,level:-1,reason:'availability'};}}
 return null;
}
export function failureKind(error){const s=String(error||'').toLowerCase();if(/quota|rate.?limit|429|usage limit|limite.*assinatura/.test(s))return 'quota';if(/unauthor|forbidden|permission|approval|denied|autoriz|permiss|login|sign in|401|403/.test(s))return 'access';if(/timeout|timed out|demorou|network|connection|conexao|conexão|desconect|encerr[oó]u|socket|fetch failed/.test(s))return 'connection';if(/model.*(not found|unavailable|unsupported)|modelo.*indispon/.test(s))return 'model';return 'execution';}
export function retryDecision(job,models){if(job.cancelRequested||job.status==='interrupted'||job.voice)return {retry:false,reason:'interrupted'};if((job.attempts?.length||0)>=MAX_ATTEMPTS)return {retry:false,reason:'limit'};if(job.possibleSideEffects||job.turnStartUncertain)return {retry:false,reason:'partial_execution'};if(job.reportedOutcome?.retryable===false)return {retry:false,reason:'blocked'};if(['quota','access','connection'].includes(failureKind(job.error)))return {retry:false,reason:failureKind(job.error)};const route=chooseRoute(job,models);return route?{retry:true,route}:{retry:false,reason:'no_stronger_model'};}
export function createFailureMemory(root){const file=path.join(root,'.runtime/task-failures.json');const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{version:1,entries:[]};const save=()=>{fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);};
 function record(job,{terminal=false,event='failure'}={}){const attempt=job.attempts?.at(-1),id=job.id+':'+(attempt?.number||0)+':'+event;let entry=data.entries.find(e=>e.id===id);if(!entry){entry={id,jobId:job.id,agentId:job.agentId,conversationId:job.conversationId,at:new Date().toISOString(),event,attempt:attempt?.number||0,model:attempt?.model||null,effort:attempt?.effort||null,request:String(job.text||'').slice(0,3000),error:String(job.error||job.lastTransportError||'').slice(0,2000),kind:failureKind(job.error||job.lastTransportError),possibleSideEffects:!!job.possibleSideEffects,external:!!job.a2a,selfReview:!!job.feedbackReview};data.entries.push(entry);}entry.terminal=terminal;entry.retryStop=job.retryStop||null;save();return entry;}
 function resolve(job){for(const e of data.entries.filter(e=>e.jobId===job.id)){e.resolved=job.status==='completed';e.finalModel=job.route?.model;e.finalEffort=job.route?.effort;}save();}
 return {record,resolve,entries:()=>data.entries};
}
export const outcomeTool={type:'function',name:'team_report_outcome',description:'Registra que a tarefa não pôde ser concluída ou verificada. Use antes de encerrar quando faltar capacidade ou houver um bloqueio. Não invente falhas. retryable=true apenas se um modelo mais capaz puder resolver; false para acesso, autorização, dados ausentes ou dependência externa. Não reinicia a tarefa imediatamente.',inputSchema:{type:'object',properties:{reason:{type:'string',maxLength:2000},retryable:{type:'boolean'}},required:['reason','retryable'],additionalProperties:false}};
