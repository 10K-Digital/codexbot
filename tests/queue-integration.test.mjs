import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

test('HTTP messages run while other agents await review; decisions resume within capacity',async t=>{
 const source=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'codexbot-queue-'));let child;
 t.after(async()=>{if(child&&child.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}fs.rmSync(root,{recursive:true,force:true});});
 for(const name of fs.readdirSync(source).filter(n=>n.endsWith('.mjs')))fs.copyFileSync(path.join(source,name),path.join(root,name));
 for(const name of ['dist','builtin-skills'])fs.cpSync(path.join(source,name),path.join(root,name),{recursive:true});
 fs.symlinkSync(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
 const fake=path.join(root,'fake-codex.cjs');
 fs.writeFileSync(fake,`#!${process.execPath}
 const fs=require('fs'),rl=require('readline').createInterface({input:process.stdin});let n=0,seq=10000;
 const pending=new Map(),turns=new Map(),out=x=>process.stdout.write(JSON.stringify(x)+'\\n');
 const finish=(threadId,status='completed')=>{out({method:'item/completed',params:{threadId,item:{type:'agentMessage',id:'m'+threadId,text:'Synthetic reply'}}});out({method:'turn/completed',params:{threadId,turn:{id:turns.get(threadId),status}}});};
 rl.on('line',line=>{const x=JSON.parse(line);fs.appendFileSync(${JSON.stringify(path.join(root,'rpc.jsonl'))},line+'\\n');
  if(!x.method){if(pending.has(x.id)){const thread=pending.get(x.id);pending.delete(x.id);if(![...pending.values()].includes(thread))finish(thread);}return;}if(!x.id)return;
  let result={};if(x.method==='account/read')result={account:{type:'chatgpt',planType:'test'}};
  if(x.method==='model/list')result={data:[{model:'gpt-6-astra',supportedReasoningEfforts:[{reasoningEffort:'low'}]}]};
  if(x.method==='thread/start')result={thread:{id:'t'+(++n)}};
  if(x.method==='turn/start'){turns.set(x.params.threadId,'turn'+n);result={turn:{id:'turn'+n}};}out({id:x.id,result});
  if(x.method==='turn/interrupt')setImmediate(()=>finish(x.params.threadId,'interrupted'));
  if(x.method==='turn/start'){const threadId=x.params.threadId,text=x.params.input[0].text.split('Mensagem atual do usuário:').at(-1);
   if(text.includes('WAIT')){for(let i=0;i<(text.includes('MULTIPLE')?2:1);i++){const id=++seq;pending.set(id,threadId);setImmediate(()=>out({id,method:'mcpServer/elicitation/request',params:{threadId,message:'Synthetic review',requestedSchema:{type:'object',properties:{}}}}));}}
   else if(!text.includes('HOLD'))setImmediate(()=>finish(threadId));
  }
 });`,{mode:0o700});
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 child=spawn(process.execPath,[path.join(root,'server.mjs')],{env:{...process.env,EQUIPE_CODEX:fake,CODEXBOT_PORT:String(port)},stdio:'ignore'});
 let token;
 const until=async check=>{const deadline=Date.now()+10000;while(Date.now()<deadline){const result=await check();if(result)return result;await delay(25);}throw Error('Synthetic queue scenario timed out');};
 await until(async()=>{try{token=fs.readFileSync(path.join(root,'.runtime/device-token'),'utf8');return (await fetch('http://127.0.0.1:'+port+'/health')).ok;}catch{return false;}});
 const api=async(route,body)=>{const response=await fetch('http://127.0.0.1:'+port+'/api/'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await response.json();assert(response.ok,JSON.stringify(value));return value;};
 for(const id of ['wait-one','wait-two','hold-one','hold-two'])await api('agents',{name:id,description:'Synthetic agent',skills:[],browser:false});
 const send=(agentId,text)=>api('send',{agentId,text});
 const jobStatus=async(id,status)=>{const s=await api('state');return s.jobs.find(j=>j.id===id)?.status===status&&s;};
 const first=await send('wait-one','WAIT_MULTIPLE'),second=await send('wait-two','WAIT');
 await until(async()=>{const s=await api('state');return s.approvals.length===3&&s;});
 const normal=await send('general-manager','Reply to this message');
 let s=await until(()=>jobStatus(normal.jobId,'completed'));
 assert(s.messages.some(m=>m.jobId===normal.jobId&&m.role==='assistant'&&m.text==='Synthetic reply'));
 const same=await send('wait-one','Reply after review');assert.equal((await api('state')).jobs.find(j=>j.id===same.jobId).status,'queued');
 const holdOne=await send('hold-one','HOLD'),holdTwo=await send('hold-two','HOLD');
 await until(()=>jobStatus(holdTwo.jobId,'running'));
 s=await api('state');const approval=s.approvals.find(r=>r.agentId==='wait-one');
 for(const r of s.approvals.filter(r=>r.agentId==='wait-one'))await api('approval',{id:r.id,approved:true,content:{}});
 s=await api('state');assert.equal(s.jobs.find(j=>j.id===first.jobId).status,'waiting');assert.equal(s.jobs.find(j=>j.id===first.jobId).resumeQueued,true);
 assert(!s.approvals.some(r=>r.id===approval.id));assert(!JSON.stringify(s).includes('"response":{"action"'));
 const calls=()=>fs.readFileSync(path.join(root,'rpc.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert(!calls().some(x=>x.id===10001&&!x.method));
 await api('stop',{jobId:holdOne.jobId});
 s=await until(()=>jobStatus(first.jobId,'completed'));assert.equal(s.jobs.find(j=>j.id===second.jobId).status,'waiting');
 await until(()=>jobStatus(same.jobId,'completed'));
 for(const id of [10001,10002])assert.equal(calls().filter(x=>x.id===id&&!x.method).length,1);
 // A decision queued behind full capacity must not be sent after cancellation.
 const holdThree=await send('hold-one','HOLD');await until(()=>jobStatus(holdThree.jobId,'running'));
 s=await api('state');await api('approval',{id:s.approvals.find(r=>r.agentId==='wait-two').id,approved:false});
 await api('stop',{jobId:second.jobId});await until(()=>jobStatus(second.jobId,'interrupted'));
 await api('stop',{jobId:holdTwo.jobId});await api('stop',{jobId:holdThree.jobId});
 await until(async()=>!(await api('state')).jobs.some(j=>['running','queued','waiting'].includes(j.status)));
 assert(!calls().some(x=>x.id===10003&&!x.method));
});
