import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(){
 let resolve,reject;const ack=new Promise((yes,no)=>{resolve=yes;reject=no;});const finished=[];
 const ctx={running:new Map(),byAgent:new Map([['a',{id:'a'}]]),ready:true,state:{messages:[]},contextJobs:new Map(),messageThreads:new Map(),availableModels:[],
  persist(){},timestamp:()=>new Date().toISOString(),connect:async()=>{},chooseRoute:()=>({model:'test',effort:'low'}),ensureThread:async()=> 'thread',
  contextWindow:()=>({included:0,omitted:0,characters:0,text:''}),workspace:()=>'/synthetic',attachments:{materialize:()=>[]},
  rpc:async method=>{if(method==='turn/start')return ack;throw Error('timeout interrupt');},finishAttempt:job=>finished.push(job.status),pump(){}};
 const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function start(job)'),source.indexOf('function finishAttempt(job)')),ctx);
 const job={id:'j',agentId:'a',createdAt:'2026-01-01',text:'Task'},started=ctx.start(job);
 return {ctx,job,started,resolve,reject,finished};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('lost acknowledgement retains ownership after turn/started has supplied the turn ID',async()=>{
 const f=fixture();await tick();f.job.turnId='known-turn';f.job.turnStartUncertain=false;f.job.cancelRequested=true;f.reject(Error('timeout turn/start'));await f.started;
 assert.equal(f.job.status,'running');assert.equal(f.ctx.running.get('a'),f.job);assert.equal(f.finished.length,0);
});
test('rejected interrupt after cancellation during turn/start never reports stopped',async()=>{
 const f=fixture();await tick();f.job.cancelRequested=true;f.resolve({turn:{id:'known-turn'}});await f.started;
 assert.equal(f.job.status,'running');assert.equal(f.ctx.running.get('a'),f.job);assert.equal(f.finished.length,0);
});
test('a late acknowledgement failure cannot overwrite an already completed turn',async()=>{
 const f=fixture();await tick();f.job.status='completed';f.job.attemptFinalized=true;f.ctx.running.delete('a');f.reject(Error('timeout turn/start'));await f.started;
 assert.equal(f.job.status,'completed');assert.equal(f.finished.length,0);assert.equal(f.job.error,undefined);
});
test('a tool finishing after executor restart cannot reply to the replacement process',async()=>{
 let release;const replies=[],oldExecutor={};
 const ctx={child:oldExecutor,threadAgent:new Map([['thread','a']]),running:new Map([['a',{id:'j'}]]),browser:{action:()=>new Promise(resolve=>release=resolve)},reply:(...args)=>replies.push(args)};
 const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function handleRequest('),source.indexOf('function handleEvent(')),ctx);
 const request=ctx.handleRequest({id:123,method:'item/tool/call',params:{threadId:'thread',tool:'team_browser',arguments:{action:'status'}}},oldExecutor);
 ctx.child={};release({status:'ready'});await request;assert.equal(replies.length,0);
});
