import test from 'node:test';
import assert from 'node:assert/strict';
import {chatJobPresentation,renderChatJobState} from '../dist/connection.mjs';

const job=(status,extra={})=>({agentId:'a',status,...extra});
class Node{constructor(tag,attrs={},text=''){Object.assign(this,{tag,attrs,text,children:[]});}append(...nodes){this.children.push(...nodes);}all(tag){return [...(this.tag===tag?[this]:[]),...this.children.flatMap(child=>child.all(tag))];}content(){return [this.text,...this.children.map(child=>child.content())].filter(Boolean).join(' ');}}
const el=(...args)=>new Node(...args),button=(text,click)=>Object.assign(el('button',{},text),{click});
function render(view,options={}){return renderChatJobState(view,{el,button,t:key=>key,paintAvatar(){},recover(){},review(){},compose(){},...options});}

test('normal queued, running, retrying and resumed work show only Thinking without controls or diagnostics',()=>{
 for(const input of [job('queued'),job('running'),job('running',{recovering:true,error:'temporary transport failure'}),job('waiting',{resumeQueued:true})]){
  const view=chatJobPresentation([input],'a');assert.equal(view.kind,'thinking');
  const row=render(view);assert.equal(row.content(),'Pensando…');assert.equal(row.all('button').length,0);assert.equal(row.all('small').length,0);assert.equal(row.attrs.role,'status');
 }
});
test('multiple pending jobs collapse to one indicator and old failures do not reappear during a new message',()=>{
 const jobs=[job('failed',{error:'Old error'}),job('running',{route:{model:'private-model',effort:'high'},attempts:[{},{}]}),job('queued')];
 assert.equal(render(chatJobPresentation(jobs,'a')).content(),'Pensando…');
});
test('only real failures show error details and an agent recovery action',async()=>{
 for(const input of [job('running',{error:'Unconfirmed response',turnStartUncertain:true}),job('failed',{error:'failure'})]){
  const calls=[],view=chatJobPresentation([input,...(input.status==='failed'?[job('waiting',{conversationId:'thread:blocked'})]:[])],'a');assert.equal(view.kind,'failed');
  const row=render(view,{recover:id=>calls.push(id)});assert(row.content().includes(input.error));assert.equal(row.all('button').length,1);assert.equal(row.all('button')[0].text,'Destravar agente');assert.equal(row.all('details').length,1);await row.all('button')[0].click();assert.deepEqual(calls,['a']);
 }
});
test('successful completion and deliberate interruption clear the indicator',()=>{
 for(const jobs of [[],[job('completed')],[job('interrupted')],[job('interrupted',{cancelRequested:true,error:'Executor was restarted'})]])assert.equal(chatJobPresentation(jobs,'a'),null);
 assert.equal(chatJobPresentation([job('running',{conversationId:'thread:other'})],'a'),null);
});
test('required review remains visible without incorrectly offering recovery',()=>{
 const row=render(chatJobPresentation([job('waiting')],'a'));
 assert.equal(row.content(),'Aguardando sua revisão');assert.equal(row.all('button').length,0);
});
test('a queued message blocked by another conversation links to the required review',async()=>{
 const view=chatJobPresentation([job('waiting',{conversationId:'thread:review'}),job('queued')],'a'),calls=[];
 assert.equal(view.kind,'review');const row=render(view,{review:id=>calls.push(id)});assert.equal(row.all('button')[0].text,'Revisar tarefa pendente');await row.all('button')[0].click();assert.deepEqual(calls,['thread:review']);
 // External client context is never linked from a private chat.
 assert.equal(chatJobPresentation([job('waiting',{conversationId:'external',a2a:true}),job('queued')],'a').kind,'thinking');
});

test('a terminal error with no pending work offers a new message instead of an inoperative recovery',async()=>{
 const view=chatJobPresentation([job('failed',{error:'quota'})],'a');let focused=false;const row=render(view,{compose:()=>focused=true});
 assert.equal(row.all('button')[0].text,'Nova mensagem');await row.all('button')[0].click();assert(focused);
});
test('confirmed executor disconnect remains actionable even if a successor is queued',()=>{
 const jobs=[job('interrupted',{error:'Disconnected'}),job('queued')];
 const disconnected=chatJobPresentation(jobs,'a',{ready:false,error:'Disconnected'});assert.equal(disconnected.kind,'failed');assert.equal(disconnected.recoverable,true);assert.equal(render(disconnected).all('button')[0].text,'Destravar agente');
 // Initial connection and explicit reconnection are progress, not failures.
 assert.equal(chatJobPresentation(jobs,'a',{ready:false,error:null}).kind,'thinking');
});

test('a confirmed disconnect after admission is actionable on existing executor versions',()=>{
 const jobs=[job('interrupted',{error:'Disconnected',finishedAt:'2026-10-19T12:01:00Z'}),job('queued',{createdAt:'2026-10-19T12:00:59Z'})];
 assert.equal(chatJobPresentation(jobs,'a',{ready:false,error:null}).kind,'failed');
 // Prior interruptions and an ongoing reconnection do not turn new work into errors.
 jobs[1].createdAt='2026-10-19T12:02:00Z';assert.equal(chatJobPresentation(jobs,'a',{ready:false,error:null}).kind,'thinking');
 jobs[1].createdAt='2026-10-19T12:00:59Z';assert.equal(chatJobPresentation([...jobs,job('running',{agentId:'other'})],'a',{ready:false,error:null}).kind,'thinking');
});
