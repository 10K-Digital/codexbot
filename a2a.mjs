import {randomUUID,createHash} from 'node:crypto';
const active=['queued','running','waiting'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class A2AError extends Error{constructor(code,message){super(message);this.code=code;}}
const invalid=m=>{throw new A2AError(-32602,m);};
export function a2aRoute(pathname){
 if(pathname==='/.well-known/agent-card.json')return {agentId:'general-manager',card:true,legacy:false};
 if(pathname==='/a2a'||pathname==='/a2a/')return {catalog:true};
 const m=/^\/a2a\/(legacy\/)?([a-z0-9-]+)(\/\.well-known\/agent(?:-card)?\.json)?\/?$/.exec(pathname);
 return m?{agentId:m[2],legacy:!!m[1],card:!!m[3]}:null;
}
export function createA2A({catalog,state,enqueue,persist,cancel,answerInput,pendingFor,attachments,baseUrl}){
 function card(agentId,legacy=false){const a=catalog.agents.find(a=>a.id===agentId);if(!a)throw new A2AError(-32602,'Agente desconhecido.');const url=`${baseUrl}/a2a/${legacy?'legacy/':''}${a.id}`;
  const result={name:a.name,description:a.description,version:'2.0.0',capabilities:{streaming:true,pushNotifications:false},defaultInputModes:['text/plain','image/png','image/jpeg','application/pdf','application/octet-stream'],defaultOutputModes:['text/plain'],skills:[{id:a.id,name:a.name,description:a.description,tags:['equipe',a.id]}],iconUrl:baseUrl+'/icon.svg'};
  if(legacy)return {...result,protocolVersion:'0.3.0',url,preferredTransport:'JSONRPC',securitySchemes:{clientToken:{type:'http',scheme:'bearer'}},security:[{clientToken:[]}]};
  return {...result,supportedInterfaces:[{url,protocolBinding:'JSONRPC',protocolVersion:'1.0'}],securitySchemes:{clientToken:{httpAuthSecurityScheme:{scheme:'Bearer',description:'Token A2A emitido no Mac; transporte privado pela Tailnet.'}}},securityRequirements:[{schemes:{clientToken:{list:[]}}}]};
 }
 function visible(job,agentId,principal){return job.agentId===agentId&&job.a2a?.principal===principal.id;}
 function lookup(id,agentId,principal){const job=state.jobs.find(j=>j.id===id&&visible(j,agentId,principal));if(!job)throw new A2AError(-32001,'Tarefa não encontrada.');return job;}
 function status(job){return ({queued:'submitted',running:'working',waiting:pendingFor(job).some(p=>p.method!=='item/tool/requestUserInput')?'auth-required':'input-required',completed:'completed',failed:'failed',interrupted:'canceled'})[job.status]||'unknown';}
 function task(job,legacy=false,historyLength){
  if(historyLength!==undefined&&(!Number.isInteger(historyLength)||historyLength<0))invalid('historyLength deve ser um inteiro não negativo.');
  const contextId=job.a2a.contextId,st=status(job),msg=(role,text,id)=>({...(legacy?{kind:'message'}:{}),role:legacy?role:role==='user'?'ROLE_USER':'ROLE_AGENT',messageId:id,contextId,taskId:job.id,parts:[{...(legacy?{kind:'text'}:{}),text}]});
  const history=state.messages.filter(m=>m.jobId===job.id&&['assistant','user'].includes(m.role)).map(m=>msg(m.role==='user'?'user':'agent',m.text,m.id));
  const messages=state.messages.filter(m=>m.jobId===job.id&&m.role==='assistant'&&!m.streaming);const text=messages.map(m=>m.text).join('\n\n');
  const result={...(legacy?{kind:'task'}:{}),id:job.id,contextId,status:{state:legacy?st:'TASK_STATE_'+st.replaceAll('-','_').toUpperCase(),timestamp:job.finishedAt||job.startedAt||job.createdAt}};
  if(historyLength!==0&&history.length)result.history=history.slice(-Math.min(historyLength??100,100));
  if(text)result.artifacts=[{artifactId:job.id+'-response',name:'Resposta',parts:[{...(legacy?{kind:'text'}:{}),text}]}];
  if(job.status==='waiting'){const requests=pendingFor(job);const input=requests.filter(r=>r.method==='item/tool/requestUserInput').flatMap(r=>(r.params.questions||[]).map(q=>q.question)).join('\n');result.status.message=msg('agent',input||`Esta ação precisa da sua aprovação no painel privado: ${baseUrl}/`,'status-'+job.id);}
  else if(job.error&&['failed','interrupted'].includes(job.status))result.status.message=msg('agent',job.error,'status-'+job.id);
  return result;
 }
 const sendLocks=new Map();
 async function sendMessage(params,agentId,principal,legacy){const key=principal.id+':'+agentId;const previous=sendLocks.get(key)||Promise.resolve();const current=previous.catch(()=>{}).then(()=>sendMessageUnlocked(params,agentId,principal,legacy));sendLocks.set(key,current);try{return await current;}finally{if(sendLocks.get(key)===current)sendLocks.delete(key);}}
 async function sendMessageUnlocked(params,agentId,principal,legacy){
  const m=params.message;if(!m||typeof m.messageId!=='string'||!m.messageId.trim()||m.messageId.length>200)invalid('message.messageId é obrigatório.');
  if(m.role!==(legacy?'user':'ROLE_USER')||!Array.isArray(m.parts)||!m.parts.length||m.parts.length>16)invalid('Mensagem de usuário com 1–16 partes é obrigatória.');
  if(params.tenant!==undefined)invalid('Este endpoint não utiliza tenant.');
  const config=params.configuration||{};if(config.historyLength!==undefined&&(!Number.isInteger(config.historyLength)||config.historyLength<0))invalid('historyLength inválido.');if(config.pushNotificationConfig||config.taskPushNotificationConfig)throw new A2AError(-32003,'Push notifications não são suportadas.');
  if(config.acceptedOutputModes?.length&&!config.acceptedOutputModes.includes('text/plain'))throw new A2AError(-32005,'A saída suportada é text/plain.');
  const fingerprint=createHash('sha256').update(JSON.stringify(m)).digest('hex');
  const existing=state.jobs.find(j=>visible(j,agentId,principal)&&j.a2a.messageId===m.messageId);
  if(existing){if(existing.a2a.fingerprint!==fingerprint)invalid('messageId já usado com outro conteúdo.');return existing;}
  if(m.taskId){const current=lookup(m.taskId,agentId,principal);if(m.contextId&&m.contextId!==current.a2a.contextId)invalid('contextId não corresponde à tarefa.');
   if(status(current)!=='input-required')throw new A2AError(-32004,'A tarefa não aceita novas mensagens. Aprovações são realizadas no painel.');
   const text=m.parts.map(p=>p.text||'').join('\n');await answerInput(current,text);return current;
  }
  const contextId=m.contextId||randomUUID();if(typeof contextId!=='string'||contextId.length>200)invalid('contextId inválido.');
  if(m.contextId&&!state.jobs.some(j=>visible(j,agentId,principal)&&j.a2a.contextId===contextId))invalid('Contexto desconhecido para este agente/cliente.');
  const text=[],files=[];
  // Validate every part before writing files or enqueueing work. Remote URLs are never fetched.
  for(const p of m.parts){if(typeof p.text==='string'){text.push(p.text);continue;}
   const bytes=legacy?p.kind==='file'&&p.file?.bytes:p.raw;
   const name=legacy?p.file?.name:p.filename;
   if(typeof bytes!=='string'||bytes.length>140000000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bytes))throw new A2AError(-32005,'Use texto ou arquivo base64 (raw em 1.0, file.bytes em 0.3). URLs e dados estruturados não são aceitos.');
   files.push({bytes:Buffer.from(bytes,'base64'),name:name||'arquivo'});
  }
  if(files.length>10||files.reduce((n,f)=>n+f.bytes.length,0)>100*1024*1024)invalid('Use até 10 arquivos, total de 100 MB.');
  if(text.join('\n').length>32000)invalid('Texto acima de 32000 caracteres.');
  const uploaded=[];for(const f of files)uploaded.push(await attachments.upload([f.bytes],f.name,principal.id));
  return enqueue(agentId,text.join('\n')||'Analise os arquivos anexados.',{from:'user',attachments:uploaded.map(f=>f.id),attachmentOwner:principal.id,a2a:{principal:principal.id,contextId,messageId:m.messageId,fingerprint,agentIds:principal.agentIds}});
 }
 async function wait(job,res){while(active.includes(job.status)&&job.status!=='waiting'&&!res.destroyed)await sleep(250);}
 async function stream(res,id,job,legacy){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();let last='',lastBeat=Date.now();
  const write=result=>res.write('data: '+JSON.stringify({jsonrpc:'2.0',id,result})+'\n\n');write(legacy?task(job,true):{task:task(job)});
  while(!res.destroyed){const t=task(job,legacy,0),serialized=JSON.stringify(t);if(serialized!==last){if(t.artifacts)for(const artifact of t.artifacts)write(legacy?{kind:'artifact-update',taskId:job.id,contextId:t.contextId,artifact,append:false,lastChunk:!active.includes(job.status)}:{artifactUpdate:{taskId:job.id,contextId:t.contextId,artifact,append:false,lastChunk:!active.includes(job.status)}});write(legacy?{kind:'status-update',taskId:job.id,contextId:t.contextId,status:t.status,final:!active.includes(job.status)||job.status==='waiting'}:{statusUpdate:{taskId:job.id,contextId:t.contextId,status:t.status}});last=serialized;}
   if(!active.includes(job.status)||job.status==='waiting')break;if(Date.now()-lastBeat>15000){res.write(': keepalive\n\n');lastBeat=Date.now();}await sleep(500);
  }if(!res.destroyed)res.end();
 }
 async function handle(req,res,route,principal,readBody){
  const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};let id=null;
  try{
   if(route.catalog){if(req.method!=='GET')return send(405,{error:'Use GET'});return send(200,{agents:catalog.agents.filter(a=>principal.agentIds.includes(a.id)).map(a=>({id:a.id,name:a.name,agentCardUrl:`${baseUrl}/a2a/${a.id}/.well-known/agent-card.json`,legacyCardUrl:`${baseUrl}/a2a/legacy/${a.id}/.well-known/agent-card.json`}))});}
   if(!principal.agentIds.includes(route.agentId))return send(403,{error:'Agente fora do escopo desta credencial.'});
   if(route.card){if(req.method!=='GET')return send(405,{error:'Use GET'});return send(200,card(route.agentId,route.legacy));}
   if(req.method!=='POST')return send(405,{error:'Use POST JSON-RPC'});
   const r=await readBody(req,150*1024*1024);id=r?.id??null;if(!r||Array.isArray(r)||r.jsonrpc!=='2.0'||!['string','number'].includes(typeof r.id)||typeof r.method!=='string')throw new A2AError(-32600,'Requisição JSON-RPC inválida.');
   const expected=route.legacy?'0.3':'1.0';if(req.headers['a2a-version']&&!req.headers['a2a-version'].startsWith(expected))throw new A2AError(-32009,'Versão não suportada neste endpoint.');
   const p=r.params||{};let result,job;const legacy=route.legacy;
   if(['SendMessage','SendStreamingMessage',...(legacy?['message/send','message/stream']:[])].includes(r.method)){
    job=await sendMessage(p,route.agentId,principal,legacy);
    if(['SendStreamingMessage','message/stream'].includes(r.method))return await stream(res,id,job,legacy);
    if(legacy?p.configuration?.blocking!==false:p.configuration?.returnImmediately!==true)await wait(job,res);
    result=legacy?task(job,true,p.configuration?.historyLength):{task:task(job,false,p.configuration?.historyLength)};
   }else if(['GetTask',...(legacy?['tasks/get']:[])].includes(r.method)){result=task(lookup(p.id,route.agentId,principal),legacy,p.historyLength);}
   else if(['CancelTask',...(legacy?['tasks/cancel']:[])].includes(r.method)){job=lookup(p.id,route.agentId,principal);if(!active.includes(job.status))throw new A2AError(-32002,'Tarefa já encerrada.');await cancel(job);await wait(job,res);result=task(job,legacy,p.historyLength);}
   else if(['SubscribeToTask',...(legacy?['tasks/resubscribe']:[])].includes(r.method)){job=lookup(p.id,route.agentId,principal);if(!active.includes(job.status))throw new A2AError(-32004,'Tarefa já encerrada.');return await stream(res,id,job,legacy);}
   else if(r.method==='ListTasks'){
    if(p.statusTimestampAfter!==undefined&&!Number.isFinite(Date.parse(p.statusTimestampAfter)))invalid('statusTimestampAfter inválido.');const size=p.pageSize??50;if(!Number.isInteger(size)||size<1||size>100)invalid('pageSize deve ser 1–100.');const offset=p.pageToken?Number(p.pageToken):0;if(!Number.isSafeInteger(offset)||offset<0)invalid('pageToken inválido.');
    const jobs=state.jobs.filter(j=>visible(j,route.agentId,principal)&&(!p.contextId||j.a2a.contextId===p.contextId)&&(!p.status||task(j).status.state===p.status)&&(!p.statusTimestampAfter||Date.parse(j.finishedAt||j.startedAt||j.createdAt)>Date.parse(p.statusTimestampAfter))).slice().reverse();result={tasks:jobs.slice(offset,offset+size).map(j=>{const t=task(j,legacy,p.historyLength);if(!p.includeArtifacts)delete t.artifacts;return t;}),nextPageToken:offset+size<jobs.length?String(offset+size):'',pageSize:size,totalSize:jobs.length};
   }else if(/PushNotification|pushNotification/.test(r.method))throw new A2AError(-32003,'Push notifications não são suportadas.');
   else throw new A2AError(-32601,'Método não suportado.');
   if(!res.destroyed)send(200,{jsonrpc:'2.0',id,result});
  }catch(e){if(!res.headersSent)send(200,{jsonrpc:'2.0',id,error:{code:e.code|| (e instanceof SyntaxError?-32700:-32602),message:e.message}});else res.end();}
 }
 return {handle,card,task};
}
