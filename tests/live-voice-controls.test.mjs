import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('live button toggles off during microphone permission and releases a late stream',async()=>{
 let resolveStream,stopped=0,removed=0;
 const states=[],requests=[];
 const node=()=>({append(){},after(){},remove(){removed++;},pause(){},close(){},setAttribute(){}});
 const context=vm.createContext({
  t:x=>x,document:{querySelector:()=>({...node(),textContent:'Misc'}),addEventListener(){},removeEventListener(){}},
  window:{addEventListener(){},removeEventListener(){}},
  navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolveStream=r)}},
  RTCPeerConnection:class{},clearInterval,clearTimeout,setInterval,setTimeout
 });
 vm.runInContext(fs.readFileSync(new URL('../dist/live-voice.js',import.meta.url),'utf8').replace(/^import .*;\n/,'').replace('export function','function')+'\nglobalThis.control=liveVoiceControl;',context);
 const toggle=context.control({api:async(...args)=>requests.push(args),el:node,button:node,toast:()=>{},onState:s=>states.push(s)});
 const pending=toggle('misc');
 assert.deepEqual(states,[true]);
 await toggle('misc');
 assert.deepEqual(states,[true,false]);
 resolveStream({getTracks:()=>[{stop(){stopped++;}}]});
 await pending;
 assert.equal(stopped,1);assert.equal(removed,1);assert.deepEqual(requests,[]);
});
