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
 const api=createRoutines({state,persist(){writes++;},enqueue(){throw Error('Deleted routine dispatched');}});api.remove({id:'r'});api.tick();assert.deepEqual(api.list(),[]);assert.equal(state.jobs[0].status,'queued');assert.equal(state.messages[0].text,'history');assert.equal(state.scheduleSlots.r,undefined);assert.equal(state.deletedRoutines[0].prompt,'Do work');assert.equal(writes,1);
 const restored=createRoutines({state:JSON.parse(JSON.stringify(state)),persist(){}});assert.deepEqual(restored.list(),[]);assert.throws(()=>api.remove({id:'missing'}));assert.throws(()=>api.remove({id:'codexbot-feedback-review'}),/nativa/);
});
