import test from 'node:test';import assert from 'node:assert/strict';
import {createRoutines} from '../routines.mjs';import {scheduleToCron,cronToSchedule} from '../dist/schedule.mjs';import {scheduleSlot} from '../lib.mjs';
test('friendly schedules preserve imported execution slots',()=>{for(const cron of ['6 10,16 * * 1-5','0 7-23 * * *','0 9-19/2 * * *','0 8-20/4 * * *','0 9,15 * * 1-6','30 9 31 * *']){const converted=scheduleToCron(cronToSchedule(cron));for(let t=Date.parse('2026-09-18T00:00:00Z');t<Date.parse('2026-09-26T00:00:00Z');t+=60000){const d=new Date(t);assert.equal(scheduleSlot(cron,d),scheduleSlot(converted,d));}}});
test('custom schedules are preserved and invalid values fail closed',()=>{assert.equal(cronToSchedule('*/5 * * * *'),null);for(const schedule of [{kind:'weekly',minute:0,days:[],hours:[8]},{kind:'interval',minute:0,days:[1],start:20,end:8,every:2},{kind:'monthly',minute:0,day:32,hours:[8]}])assert.throws(()=>scheduleToCron(schedule));});
test('routine tools enforce owner access and atomic validation; pause preserves running job',()=>{let writes=0;const state={routines:[{id:'r',agentId:'gm',cron:'0 9 * * *',prompt:'old',enabled:true}],jobs:[{routineId:'r',status:'running'}]},api=createRoutines({state,persist:()=>writes++});for(const job of [null,{a2a:{}},{feedbackReview:'x'}])assert.throws(()=>api.call(job,'team_update_routine',{id:'r',enabled:false}));assert.throws(()=>api.update({id:'r',cron:'0 8 * * *',enabled:'yes'}));assert.equal(state.routines[0].cron,'0 9 * * *');const result=api.call({},'team_update_routine',{id:'r',enabled:false});assert.equal(result.enabled,false);assert.equal(result.running,true);assert.equal(state.jobs[0].status,'running');assert.equal(writes,1);assert.equal(api.list({agentId:'other'}).length,0);api.update({id:'r',enabled:true});assert.equal(state.routines[0].enabled,true);});
test('native feedback toggle preserves automatic-apply preference',()=>{let settings={enabled:true,autoApply:false};const api=createRoutines({state:{routines:[],jobs:[]},persist(){},feedback:{publicState:()=>({settings}),settings:b=>settings=b}});api.call({},'team_update_routine',{id:'codexbot-feedback-review',enabled:false});assert.deepEqual(settings,{enabled:false,autoApply:false});assert.throws(()=>api.update({id:'codexbot-feedback-review',schedule:{}}));});
test('one-time schedule catches up once, survives restart and can be rescheduled',()=>{
 let time=Date.parse('2027-01-01T10:00:00Z'),calls=0;
 const state={routines:[{id:'r',agentId:'gm',prompt:'task',cron:'0 9 * * *',enabled:true}],jobs:[]};
 const args={state,persist(){},now:()=>time,enqueue(){calls++;state.jobs.push({routineId:'r',status:'queued'});}};
 let api=createRoutines(args);api.update({id:'r',schedule:{kind:'once',at:'2027-01-01T09:00:00-03:00'}});
 assert.equal(api.list()[0].schedule.at,'2027-01-01T12:00:00.000Z');assert.equal(state.routines[0].cron,null);
 api.tick();assert.equal(calls,0);time+=86400000;api.tick();assert.equal(calls,1);assert.equal(state.routines[0].enabled,false);
 state.jobs[0].status='completed';api=createRoutines(args);api.tick();assert.equal(calls,1);assert.throws(()=>api.update({id:'r',enabled:true}));
 api.update({id:'r',enabled:true,schedule:{kind:'once',at:'2027-01-03T09:00:00-03:00'}});assert.equal(state.routines[0].dispatchedAt,undefined);
 api.update({id:'r',enabled:false});time+=2*86400000;api.tick();assert.equal(calls,1);
 api.update({id:'r',schedule:{kind:'weekly',days:[1],hours:[9],minute:0}});assert.equal(state.routines[0].schedule,undefined);assert.equal(state.routines[0].cron,'0 9 * * 1');
});
test('one-time validation is atomic and failed enqueue or busy job does not consume it',()=>{
 let time=Date.parse('2027-01-01T10:00:00Z'),fail=true,calls=0;
 const state={routines:[{id:'r',agentId:'gm',prompt:'task',cron:'0 9 * * *',enabled:true}],jobs:[]};
 const api=createRoutines({state,persist(){},now:()=>time,enqueue(){if(fail)throw Error('full');calls++;}});
 for(const at of ['2027-02-30T09:00:00-03:00','2026-01-01T09:00:00Z','2027-01-01T09:00','nonsense'])assert.throws(()=>api.update({id:'r',schedule:{kind:'once',at}}));
 assert.equal(state.routines[0].cron,'0 9 * * *');api.update({id:'r',schedule:{kind:'once',at:'2027-01-01T12:00:00Z'}});time+=86400000;
 api.tick();assert.equal(state.routines[0].enabled,true);assert.equal(state.routines[0].dispatchedAt,undefined);
 fail=false;state.jobs.push({routineId:'r',status:'running'});api.tick();assert.equal(calls,0);state.jobs=[];api.tick();api.tick();assert.equal(calls,1);
});
