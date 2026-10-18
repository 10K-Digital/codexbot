import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('routine history is concise while executor and retries retain the complete instructions',()=>{
 const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),messages=[];
 const ctx={recovery:{busy:false},state:{jobs:[],routines:[{id:'r',name:'Check de delegações GM'}]},byAgent:new Map([['a',{}]]),attachments:{get(){},publicFile(){}},safeText:x=>x,randomUUID:()=>String(messages.length),timestamp:()=>new Date().toISOString(),message:(agentId,role,text,extra)=>messages.push({agentId,role,text,...extra}),persist(){},pump(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function enqueue('),source.indexOf('const failureMemory=')),ctx);
 const prompt='Instruções completas e detalhadas\nPasso 1\nPasso 2';
 const job=ctx.enqueue('a',prompt,{routineId:'r',from:'Rotina: Check de delegações GM'});
 assert.equal(job.text,prompt);assert.equal(messages[0].text,'Executando rotina Check de delegações GM…');assert.equal(messages[0].role,'system');assert.equal(messages[0].jobId,job.id);
 ctx.enqueue('a','Mensagem comum');assert.equal(messages[1].text,'Mensagem comum');assert.equal(messages[1].role,'user');
 ctx.enqueue('a',prompt,{routineId:'r',suppressUser:true});assert.equal(messages.length,2);
});
