import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecovery} from '../recovery.mjs';
function fixture(interrupt=async job=>{job.status='interrupted';},restart=async()=>{}){
 const state={jobs:[{id:'a1',agentId:'a',status:'waiting'},{id:'a2',agentId:'a',status:'queued'},{id:'b1',agentId:'b',status:'running'},{id:'done',agentId:'a',status:'completed'}],messages:[{text:'Keep history'}]};
 const recovery=createRecovery({state,agents:new Map([['a',{}],['b',{}]]),persist(){},interrupt,restart,timeoutMs:5});
 return {state,recovery,request:scope=>({scope,agentId:'a',confirmed:true,...recovery.preview({scope,agentId:'a'})})};
}
test('recovery targets an entire agent, preserves history and requires an exact confirmed preview',async()=>{
 const f=fixture(),before=structuredClone(f.state);
 assert.deepEqual(f.recovery.preview({scope:'agent',agentId:'a'}),{jobIds:['a1','a2'],queued:1,running:0,waiting:1});
 for(const input of [{scope:'bad'},{scope:'agent',agentId:'missing'}])assert.throws(()=>f.recovery.preview(input));
 await assert.rejects(f.recovery.recover({...f.request('agent'),confirmed:false}));
 await assert.rejects(f.recovery.recover({...f.request('agent'),jobIds:['a1','b1']}));
 assert.deepEqual(f.state,before);
 const result=await f.recovery.recover(f.request('agent'));
 assert.equal(result.stopped,2);assert.equal(result.remaining,0);assert.equal(f.state.jobs[2].status,'running');
 assert.deepEqual(f.state.messages,before.messages);assert.equal(f.state.jobs[3].status,'completed');
});
test('the complete batch is cancelled before any interrupt can release queue capacity',async()=>{
 let f;f=fixture(async()=>{assert.equal(f.state.jobs[1].status,'interrupted');assert(f.state.jobs[0].cancelRequested);f.state.jobs[0].status='interrupted';});
 await f.recovery.recover(f.request('agent'));
});
test('unconfirmed interruption stays active and recommends global recovery',async()=>{
 const f=fixture(()=>new Promise(()=>{}));const result=await f.recovery.recover(f.request('agent'));
 assert.equal(result.remaining,1);assert.equal(f.state.jobs[0].status,'waiting');assert.equal(f.recovery.busy,false);
});
test('concurrent recoveries are rejected and global failure is explicit',async()=>{
 let resolve;const f=fixture(async()=>{},()=>new Promise(r=>resolve=r));const pending=f.recovery.recover(f.request('all'));
 assert(f.recovery.busy);await assert.rejects(f.recovery.recover(f.request('all')),/andamento/);resolve();await pending;
 const failed=fixture(async()=>{},async()=>{throw Error('private diagnostic');});const result=await failed.recovery.recover(failed.request('all'));
 assert.equal(result.reconnected,false);assert(result.error);assert(!result.error.includes('private diagnostic'));assert.equal(result.remaining,2);
});
