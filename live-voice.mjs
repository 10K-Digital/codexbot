import {randomUUID} from 'node:crypto';
export function createLiveVoice({rpc,begin,finish,transcript,now=Date.now,maxMinutes=20,idleMs=45000}){
 let active=null;
 function get(id){if(!active||active.id!==id)throw Error('Sessão de voz encerrada.');return active;}
 async function stop(id,reason='requested'){
  const s=get(id);if(s.closing)return;s.closing=true;s.phase='closed';s.reason=reason;s.reject?.(Error(s.error||'Sessão de voz encerrada.'));s.reject=null;
  try{if(s.job?.threadId)await rpc('thread/realtime/stop',{threadId:s.job.threadId});}catch{}finally{await finish(s.job,reason);if(active===s)active=null;}
 }
 async function start({agentId,sdp}){
  if(active)throw Error('Já existe uma conversa por voz em andamento.');
  if(typeof agentId!=='string'||typeof sdp!=='string'||sdp.length>64000||!sdp.startsWith('v=0'))throw Error('Pedido de voz inválido.');
  const s={id:randomUUID(),started:now(),lastSeen:now(),phase:'connecting',job:null};active=s;
  let timer;try{s.job=await begin(agentId);s.job.voiceSessionId=s.id;s.lastSeen=now();if(s.job.cancelRequested)throw Error('Sessão de voz encerrada.');
   const answer=new Promise((resolve,reject)=>{s.resolve=resolve;s.reject=reject;timer=setTimeout(()=>reject(Error('A conexão de voz demorou. Tente a transcrição local.')),25000);});
   const [,remoteSdp]=await Promise.all([rpc('thread/realtime/start',{threadId:s.job.threadId,outputModality:'audio',version:'v3',includeStartupContext:false,transport:{type:'webrtc',sdp},prompt:(s.job.voiceContext||'')+'\nConverse no idioma do usuário, com respostas curtas. Você é o agente selecionado do Codexbot. Use o agente Codex para executar tarefas e respeite suas aprovações. Não afirme ter executado ações sem confirmação do agente. A conversa de voz tem limite de 20 minutos.'}),answer]);
   s.reject=null;s.phase='ready';s.lastSeen=now();return {sessionId:s.id,sdp:remoteSdp,maxMinutes};
  }catch(e){s.error=e.message;if(s.job)s.job.error=e.message;if(active===s)await stop(s.id,'error');else if(s.job)await finish(s.job,'error');throw e;}finally{clearTimeout(timer);}
 }
 function event(x){const s=active,p=x.params||{};if(!s||!s.job||p.threadId!==s.job.threadId||!x.method.startsWith('thread/realtime/'))return false;
  if(x.method==='thread/realtime/sdp')s.resolve?.(p.sdp);
  if(x.method==='thread/realtime/error'){s.error='A conexão de voz foi interrompida. Use a transcrição local ou tente novamente.';s.reject?.(Error(s.error));if(!s.reject)void stop(s.id,'error');}
  if(x.method==='thread/realtime/closed'&&!s.closing){s.reject?.(Error('Sessão de voz encerrada.'));if(!s.reject)void stop(s.id,'closed');}
  if(x.method==='thread/realtime/transcript/done'&&typeof p.text==='string'&&p.text.trim()&&['user','assistant'].includes(p.role))transcript(s.job,p.role,p.text);
  return true;
 }
 const heartbeat=id=>{const s=get(id);s.lastSeen=now();return {phase:s.phase,error:s.error||null,seconds:Math.floor((now()-s.started)/1000)};};
 const tick=()=>{if(active?.job&&!active.closing&&(now()-active.lastSeen>idleMs||now()-active.started>maxMinutes*60000))void stop(active.id,'timeout');};
 const reset=()=>{if(active&&!active.closing)void stop(active.id,'disconnected');};
 return {start,stop,heartbeat,event,tick,reset};
}
