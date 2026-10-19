import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {management} from '../management.mjs';import {createRoutines} from '../routines.mjs';
test('deleting a shared skill removes all assignments and preserves a private recovery copy',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'delete-skill-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'.private'));
 const catalog={skills:[],agents:[{id:'a',skills:[]},{id:'b',skills:[]}]},state={},byAgent=new Map(catalog.agents.map(a=>[a.id,a]));const api=management({root,catalog,state,byAgent,persist(){},resetAgent(){}});
 const skill=api.skill({name:'Custom',description:'Test',instructions:'Keep these instructions'});for(const a of catalog.agents)a.skills=[skill.id];
 api.deleteSkill({id:skill.id});assert.equal(catalog.skills.length,0);for(const a of byAgent.values())assert.deepEqual(a.skills,[]);
 const disk=JSON.parse(fs.readFileSync(path.join(root,'.private/catalog.json')));assert.equal(disk.skills.length,0);assert.deepEqual(disk.agents[0].skills,[]);
 const archive=path.join(root,'.runtime/deleted-skills');const saved=JSON.parse(fs.readFileSync(path.join(archive,fs.readdirSync(archive)[0])));assert.equal(saved.instructions,'Keep these instructions');assert.deepEqual(saved.agentIds,['a','b']);
 assert.throws(()=>api.deleteSkill({id:skill.id}));
 const native=api.installNativeSkill({name:'Codexbot Feedback Review',description:'System',instructions:'Protected'});assert.throws(()=>api.deleteSkill({id:native.id}),/nativas/);assert.equal(catalog.skills.length,1);
});
test('deleting a routine prevents future dispatch while preserving queued work and history',()=>{
 const routine={id:'r',agentId:'a',name:'Routine',prompt:'Do work',cron:'* * * * *',enabled:true};const state={routines:[routine],jobs:[{id:'j',routineId:'r',status:'queued'}],messages:[{text:'history'}],scheduleSlots:{r:'previous'}};let writes=0;
 const api=createRoutines({state,persist(){writes++;},enqueue(){throw Error('Deleted routine dispatched');}});writes=0;api.remove({id:'r'});api.tick();assert.deepEqual(api.list(),[]);assert.equal(state.jobs[0].status,'queued');assert.equal(state.messages[0].text,'history');assert.equal(state.scheduleSlots.r,undefined);assert.equal(state.deletedRoutines[0].prompt,'Do work');assert.equal(writes,1);
 const restored=createRoutines({state:JSON.parse(JSON.stringify(state)),persist(){}});assert.deepEqual(restored.list(),[]);assert.throws(()=>api.remove({id:'missing'}));assert.throws(()=>api.remove({id:'codexbot-feedback-review'}),/nativa/);
});

test('agent deletion archives configuration, stops schedules and never reuses private context',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'delete-agent-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'.private'));
 const a={id:'a',name:'A',description:'Private role',skills:['shared']},b={id:'b',name:'B',description:'Other role',skills:['shared']};
 const routine={id:'r',agentId:'a',enabled:true},channel={id:'c',members:['a']};
 const catalog={agents:[a,b],skills:[{id:'shared'}],routines:[routine]},state={routines:[routine],jobs:[{id:'j',agentId:'a',status:'queued'}],messages:[{agentId:'a',text:'Keep history'}],channels:[channel],messageThreads:[{id:'thread:m',agentId:'a',baseConversationId:'a'}],scheduleSlots:{r:'slot'}};
 const byAgent=new Map(catalog.agents.map(a=>[a.id,a]));let reset=false;
 const api=management({root,catalog,state,byAgent,persist(){},resetAgent(){reset=true;}});
 assert.throws(()=>api.deleteAgent({id:'a'}),/Confirme/);
 for(const status of ['queued','running','waiting']){state.jobs[0].status=status;assert.throws(()=>api.deleteAgent({id:'a',confirmed:true}),/pendentes/);}
 assert.equal(reset,false);assert.equal(catalog.agents.length,2);
 state.jobs[0].status='completed';api.deleteAgent({id:'a',confirmed:true});assert.equal(reset,true);
 assert.deepEqual(catalog.agents,[b]);assert.equal(byAgent.has('a'),false);assert.equal(catalog.skills.length,1);assert.deepEqual(state.channels[0].members,[]);assert.deepEqual(state.routines,[]);assert.deepEqual(catalog.routines,[]);assert.deepEqual(state.messageThreads,[]);assert.equal(state.scheduleSlots.r,undefined);assert.equal(state.jobs[0].status,'completed');assert.equal(state.messages[0].text,'Keep history');
 const dir=path.join(root,'.runtime/deleted-agents'),file=path.join(dir,fs.readdirSync(dir)[0]),archive=JSON.parse(fs.readFileSync(file));assert.equal(archive.agent.description,'Private role');assert.equal(archive.routines[0].id,'r');assert.deepEqual(archive.channels[0].members,['a']);assert.equal(fs.statSync(file).mode&0o777,0o600);
 const replacement=api.agent({name:'A',description:'New identity',skills:[]});assert.notEqual(replacement.id,'a');assert(!replacement.id.startsWith('../'));
 assert.throws(()=>api.agent({id:'a',name:'A',description:'Cannot resurrect'}));
 // A crash after catalogue commit must not restore stale schedules or thread links.
 const reloaded=JSON.parse(fs.readFileSync(path.join(root,'.private/catalog.json')));const stale={...state,routines:[routine],channels:[{id:'c',members:['a','b']}],messageThreads:[{id:'thread:m',agentId:'a'}],scheduleSlots:{r:'slot'}};
 management({root,catalog:reloaded,state:stale,byAgent:new Map(reloaded.agents.map(a=>[a.id,a])),persist(){},resetAgent(){}});assert.deepEqual(stale.routines,[]);assert.deepEqual(stale.messageThreads,[]);assert.deepEqual(stale.channels[0].members,['b']);
 api.deleteAgent({id:'b',confirmed:true});api.deleteAgent({id:replacement.id,confirmed:true});assert.deepEqual(catalog.agents,[]);
});

test('native feedback routine is hidden when its agent is deleted',()=>{const api=createRoutines({state:{routines:[],timezone:'UTC'},persist(){},feedback:{publicState:()=>({settings:{enabled:true}})},hasFeedbackAgent:()=>false});assert.deepEqual(api.list(),[]);});
