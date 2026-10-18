import test from 'node:test';
import assert from 'node:assert/strict';
import {executionAvailable} from '../lib.mjs';

const agents=new Map(['a','b','c','d'].map(id=>[id,{id,browser:id==='b'||id==='c'}]));
const jobs=(...entries)=>new Map(entries.map(([agentId,status,voice])=>[agentId,{agentId,status,voice}]));
test('waiting approvals release execution slots but preserve agent and browser ownership',()=>{
 const running=jobs(['a','waiting'],['b','waiting']);
 assert(executionAvailable(running,agents,'d'));
 assert(!executionAvailable(running,agents,'a'));
 assert(!executionAvailable(running,agents,'c'));
 assert(executionAvailable(running,agents,'b',{resume:true}));
});
test('new work and approval resumes share the execution limit',()=>{
 const running=jobs(['a','running'],['b','running'],['d','waiting']);
 assert(!executionAvailable(running,agents,'d',{resume:true}));
 running.delete('a');assert(executionAvailable(running,agents,'d',{resume:true}));
 assert(!executionAvailable(running,agents,'a',{resume:true}));
});
test('live voice retains its slot while waiting and can resume in that slot',()=>{
 const running=jobs(['a','waiting',true],['b','running']);
 assert(!executionAvailable(running,agents,'d'));
 assert(executionAvailable(running,agents,'a',{resume:true}));
});

test('several decisions for the same turn reuse its reserved execution slot',()=>{
 const running=jobs(['a','running'],['d','running']);
 assert(executionAvailable(running,agents,'a',{resume:true}));
 assert(!executionAvailable(running,agents,'b'));
});
