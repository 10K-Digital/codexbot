import test from 'node:test';import assert from 'node:assert/strict';
import {localDateInput,localToInstant,validTimezone} from '../dist/timezone.mjs';
import {scheduleSlot} from '../lib.mjs';import {createRoutines} from '../routines.mjs';import {nextFeedbackReview} from '../feedback.mjs';
test('local one-time dates handle fractional offsets and seasonal DST',()=>{
 for(const [zone,local,utc] of [['America/Sao_Paulo','2027-01-20T09:00','2027-01-20T12:00:00.000Z'],['Asia/Kolkata','2027-01-20T09:00','2027-01-20T03:30:00.000Z'],['Asia/Kathmandu','2027-01-20T09:00','2027-01-20T03:15:00.000Z'],['America/New_York','2027-01-20T09:00','2027-01-20T14:00:00.000Z'],['America/New_York','2027-07-20T09:00','2027-07-20T13:00:00.000Z']]){assert.equal(localToInstant(local,zone),utc);assert.equal(localDateInput(utc,zone),local);}
 assert.throws(()=>localToInstant('2027-03-14T02:30','America/New_York'),/não existe/);
 assert.equal(localToInstant('2027-11-07T01:30','America/New_York'),'2027-11-07T05:30:00.000Z');
 assert.throws(()=>localToInstant('2027-02-30T09:00','UTC'));assert.throws(()=>validTimezone('Not/AZone'));
});
test('recurring schedules execute in saved zones and native reviews support fractional offsets',()=>{
 const date=new Date('2027-01-20T03:30:00Z');assert(scheduleSlot('0 9 * * *',date,'Asia/Kolkata'));assert.equal(scheduleSlot('0 9 * * *',date,'America/Sao_Paulo'),null);
 assert.equal(nextFeedbackReview(Date.parse('2027-01-24T00:00:00Z'),'Asia/Kathmandu'),'2027-01-25T03:15:00.000Z');
});
test('legacy schedules keep their timezone, while edits use detected owner preference',()=>{
 let writes=0;const state={timezone:'Europe/London',routines:[{id:'r',agentId:'a',prompt:'task',cron:'0 9 * * *',enabled:false}],jobs:[]};
 const api=createRoutines({state,persist:()=>writes++});assert.equal(state.routines[0].timezone,'America/Sao_Paulo');
 api.setTimezone('Asia/Tokyo');assert.equal(state.routines[0].timezone,'America/Sao_Paulo');
 api.update({id:'r',prompt:'edited instructions'});assert.equal(state.routines[0].timezone,'America/Sao_Paulo');
 api.update({id:'r',schedule:{kind:'weekly',days:[1],hours:[9],minute:0}});assert.equal(state.routines[0].timezone,'Asia/Tokyo');
 const prior=JSON.stringify(state.routines);assert.throws(()=>api.update({id:'r',timezone:'bad',schedule:{kind:'weekly'}}));assert.equal(JSON.stringify(state.routines),prior);
 const count=writes;api.setTimezone('Asia/Tokyo');assert.equal(writes,count);assert.throws(()=>api.setTimezone('bad'));assert.equal(state.timezone,'Asia/Tokyo');
});
