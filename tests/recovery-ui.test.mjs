import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryDialog} from '../dist/recovery.mjs';
class Node{constructor(tag,attrs={},text=''){Object.assign(this,{tag,attrs,textContent:text,children:[]});}append(...items){for(const item of items){this.children=this.children.filter(x=>x!==item);this.children.push(item);}}}
const el=(...args)=>new Node(...args);
const button=(text,click)=>Object.assign(el('button',{},text),{click});
const tick=()=>new Promise(r=>setImmediate(r));
test('recovery previews first, requires explicit confirmation and does not retry a mutable failure',async()=>{
 const calls=[];let closed=false;
 const box=recoveryDialog({scope:'agent',agentId:'a',name:'Agent',el,button,t:(key,params)=>params?.name?key.replace('{name}',params.name):key,openDialog(){},close(){closed=true;},refresh:async()=>{},api:async(route,input)=>{calls.push(input);if(input.action==='preview')return {jobIds:['j'],queued:1,running:0,waiting:0};throw Error('Queue changed');}});
 await tick();const actions=box.children.at(-1),[cancel,confirm,reload]=actions.children;
 assert.equal(calls.length,1);assert.equal(confirm.disabled,false);assert.equal(calls[0].action,'preview');
 await confirm.click();assert.deepEqual(calls[1],{action:'recover',scope:'agent',agentId:'a',jobIds:['j'],confirmed:true});
 assert.equal(calls.length,2);assert.equal(reload.hidden,false);assert.equal(confirm.hidden,true);await cancel.click();assert(closed);
});
test('an idle agent disables confirmation; global recovery remains available with no tasks',async()=>{
 for(const scope of ['agent','all']){const box=recoveryDialog({scope,agentId:'a',el,button,t:key=>key,openDialog(){},close(){},refresh:async()=>{},api:async()=>({jobIds:[],queued:0,running:0,waiting:0})});await tick();assert.equal(box.children.at(-1).children[1].disabled,scope==='agent');}
});
