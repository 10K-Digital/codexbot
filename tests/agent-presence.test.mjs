import test from 'node:test';
import assert from 'node:assert/strict';
import {attention,avatarSeed,createAgentPresence} from '../dist/connection.mjs';
test('counts completed unread replies and keeps pending approvals after reading',()=>{
 const state={messages:[{id:'1',agentId:'a',role:'assistant',createdAt:'2026-09-17T10:00:00Z'},{id:'2',agentId:'a',role:'assistant',streaming:true,createdAt:'2026-09-17T11:00:00Z'},{id:'3',agentId:'a',role:'user',createdAt:'2026-09-17T11:00:00Z'}],jobs:[],approvals:[{agentId:'a'}]};
 assert.deepEqual(attention(state,'a'),{unread:1,approvals:1,tasks:0,total:2});
 assert.deepEqual(attention(state,'a',{a:'2026-09-17T10:00:00Z'}),{unread:0,approvals:1,tasks:0,total:1});
});
test('channel replies and approvals stay with their conversation',()=>{
 const state={messages:[{agentId:'a',conversationId:'channel:c',role:'assistant',createdAt:'2026-09-17'}],jobs:[{id:'j',agentId:'a',conversationId:'channel:c',status:'waiting'}],approvals:[{agentId:'a',jobId:'j'}]};
 assert.equal(attention(state,'a').total,0);assert.equal(attention(state,'channel:c').total,2);
});
test('avatar identity is stable across renders',()=>{assert.equal(avatarSeed('general-manager'),avatarSeed('general-manager'));assert.notEqual(avatarSeed('general-manager'),avatarSeed('inbox-triage'));});

test('agent badge includes thread unread and pending cards without double counting',()=>{
 const state={messages:[{id:'m',agentId:'a',conversationId:'thread:one',role:'assistant',createdAt:'2026-09-19T10:00:00Z'},{id:'c',agentId:'a',role:'assistant',createdAt:'2026-09-19T11:00:00Z',card:{actions:[{id:'yes'}]}}],jobs:[],approvals:[]};
 assert.equal(attention(state,'a',{},true).total,2);assert.equal(attention(state,'a',{},true).tasks,1);
 const seen={a:'2026-09-19T12:00:00Z'};assert.equal(attention(state,'a',seen,true).total,2);
 seen['thread:one']='2026-09-19T12:00:00Z';assert.equal(attention(state,'a',seen,true).total,1);
 state.messages[1].card.response={};assert.equal(attention(state,'a',seen,true).total,0);
});
test('waiting jobs deduplicate approvals and superseded replies do not count',()=>{
 const state={messages:[{agentId:'a',role:'assistant',createdAt:'2026-09-19',superseded:true}],jobs:[{id:'j',agentId:'a',status:'waiting'}],approvals:[]};
 assert.deepEqual(attention(state,'a'),{unread:0,approvals:0,tasks:1,total:1});state.approvals.push({agentId:'a',jobId:'j'});assert.deepEqual(attention(state,'a'),{unread:0,approvals:1,tasks:0,total:1});
});
test('reply completed after reading becomes unread even when created earlier',()=>{
 const state={messages:[{agentId:'a',jobId:'j',role:'assistant',createdAt:'2026-09-19T10:00:00Z'}],jobs:[{id:'j',finishedAt:'2026-09-19T10:10:00Z'}],approvals:[]};assert.equal(attention(state,'a',{a:'2026-09-19T10:05:00Z'}).unread,1);
});
test('presence loops for active work, celebrates success once and never celebrates failures or initial history',()=>{
 const p=createAgentPresence();p.update([{id:'old',agentId:'a',status:'completed'}],100);assert.equal(p.get('a',100).celebration,null);
 p.update([{id:'j',agentId:'a',conversationId:'thread:one',status:'running'}],200);assert.equal(p.get('a',200).working,true);assert.equal(p.get('thread:one',200).working,true);
 p.update([{id:'j',agentId:'a',conversationId:'thread:one',status:'completed'}],300);assert.equal(p.get('a',300).working,false);assert.equal(p.get('a',300).celebration,'j');
 p.update([{id:'j',agentId:'a',conversationId:'thread:one',status:'completed'}],1500);assert.equal(p.get('a',1500).celebration,null);
 p.update([{id:'bad',agentId:'b',status:'failed'},{id:'pending',agentId:'c',status:'waiting'},{id:'queued',agentId:'d',status:'queued'}],1600);assert.equal(p.get('b',1600).celebration,null);assert.equal(p.get('c',1600).working,false);assert.equal(p.get('d',1600).working,true);
});

test('answered reviews waiting for capacity do not request attention again',()=>{
 const state={messages:[],jobs:[{id:'j',agentId:'a',status:'waiting',resumeQueued:true}],approvals:[]};
 assert.deepEqual(attention(state,'a'),{unread:0,approvals:0,tasks:0,total:0});
});
