import test from 'node:test';import assert from 'node:assert/strict';import {sameSecret,originAllowed,validCron,scheduleSlot} from '../lib.mjs';
test('token comparisons fail closed',()=>{assert.equal(sameSecret('Bearer correct','Bearer correct'),true);assert.equal(sameSecret('Bearer correct','Bearer wrong'),false);assert.equal(sameSecret(undefined,'Bearer correct'),false);});
test('origins are exact, including scheme and port',()=>{assert(originAllowed('https://workspace.example.com','https://workspace.example.com',4320));assert(!originAllowed('https://workspace.example.com.evil.test','https://workspace.example.com',4320));assert(!originAllowed('http://localhost:9999','https://workspace.example.com',4320));});
test('weekday routine uses São Paulo and does not run on weekends',()=>{assert.equal(scheduleSlot('0 8,12,17 * * 1-5',new Date('2026-09-16T11:00:00Z')),'2026-09-16T08:00');assert.equal(scheduleSlot('0 8,12,17 * * 1-5',new Date('2026-09-19T11:00:00Z')),null);assert.equal(scheduleSlot('0 8,12,17 * * 1-5',new Date('2026-09-16T11:01:00Z')),null);});
test('hourly bounds and step match migrated schedules',()=>{assert(scheduleSlot('0 9-19/2 * * *',new Date('2026-09-16T14:00:00Z')));assert.equal(scheduleSlot('0 9-19/2 * * *',new Date('2026-09-16T13:00:00Z')),null);assert.equal(scheduleSlot('0 7-23 * * *',new Date('2026-09-17T03:00:00Z')),null);});
test('invalid schedules rejected; standard DOM/DOW OR semantics',()=>{for(const c of ['60 8 * * *','0 24 * * *','* * * *','*/0 * * * *','0 19-9 * * *'])assert(!validCron(c));assert(scheduleSlot('0 8 1 * 3',new Date('2026-09-16T11:00:00Z')));});

import {remoteAuthorized,recordTurnError,completeTurn} from '../lib.mjs';
import {connectionState} from '../dist/connection.mjs';
test('recovered Codex errors never become terminal failures',()=>{
 const job={status:'running'};recordTurnError(job,{willRetry:true,error:{message:'Temporary connection failure'}});
 assert.equal(job.error,undefined);assert.equal(job.recovering,true);
 completeTurn(job,{status:'completed'});assert.equal(job.status,'completed');assert.equal(job.error,undefined);assert.equal(job.lastTransportError,undefined);
 const failed={status:'running'};recordTurnError(failed,{error:{message:'Upstream unavailable'}});completeTurn(failed,{status:'failed'});assert.equal(failed.error,'Upstream unavailable');
});
test('connection failures require repeated evidence; recovery clears warning',()=>{
 let state=connectionState({}, {ok:false,now:0});assert.equal(state.phase,'reconnecting');
 state=connectionState(state,{ok:false,now:9000});assert.equal(state.phase,'reconnecting');
 state=connectionState(state,{ok:false,now:18000});assert.equal(state.phase,'offline');
 state=connectionState(state,{ok:true,now:19000});assert.equal(state.phase,'connected');assert.equal(state.failures,0);
 assert.equal(connectionState({}, {ok:false,status:403,now:0}).phase,'unauthorized');
});
test('remote access requires exact owner, exact host and loopback proxy',()=>{
 const config={origin:'https://mac.example.ts.net',login:'owner@example.test'},request={host:'mac.example.ts.net',login:'owner@example.test',address:'127.0.0.1'};
 assert(remoteAuthorized(request,config));
 for(const patch of [{login:'other@example.test'},{login:undefined},{host:'mac.example.ts.net.evil.test'},{address:'192.168.1.1'}])assert(!remoteAuthorized({...request,...patch},config));
 assert(!remoteAuthorized(request,null));assert(!originAllowed('https://evil.test','https://site.test',4320,config.origin));assert(originAllowed(config.origin,'https://site.test',4320,config.origin));
});
