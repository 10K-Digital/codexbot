import test from 'node:test';
import assert from 'node:assert/strict';
import {attention,avatarSeed} from '../dist/connection.mjs';
test('counts completed unread replies and keeps pending approvals after reading',()=>{
 const state={messages:[{id:'1',agentId:'a',role:'assistant',createdAt:'2026-09-17T10:00:00Z'},{id:'2',agentId:'a',role:'assistant',streaming:true,createdAt:'2026-09-17T11:00:00Z'},{id:'3',agentId:'a',role:'user',createdAt:'2026-09-17T11:00:00Z'}],jobs:[],approvals:[{agentId:'a'}]};
 assert.deepEqual(attention(state,'a'),{unread:1,approvals:1,total:2});
 assert.deepEqual(attention(state,'a',{a:'2026-09-17T10:00:00Z'}),{unread:0,approvals:1,total:1});
});
test('channel replies and approvals stay with their conversation',()=>{
 const state={messages:[{agentId:'a',conversationId:'channel:c',role:'assistant',createdAt:'2026-09-17'}],jobs:[{id:'j',agentId:'a',conversationId:'channel:c',status:'waiting'}],approvals:[{agentId:'a',jobId:'j'}]};
 assert.equal(attention(state,'a').total,0);assert.equal(attention(state,'channel:c').total,2);
});
test('avatar identity is stable across renders',()=>{assert.equal(avatarSeed('general-manager'),avatarSeed('general-manager'));assert.notEqual(avatarSeed('general-manager'),avatarSeed('inbox-triage'));});
