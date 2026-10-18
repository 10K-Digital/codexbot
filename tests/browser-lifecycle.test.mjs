import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import vm from 'node:vm';
import {virtualBrowser} from '../virtual-browser.mjs';

function harness({mode='ready',attachFails=false,deferKill=false}={}){
 const children=[],profiles=[],calls=[];let currentMode=mode,failAttach=attachFails,failList=false;
 const page={id:'page',type:'page',url:'about:blank',webSocketDebuggerUrl:'ws://127.0.0.1:9222/page'};
 class Socket extends EventTarget{
  readyState=1;
  constructor(){super();queueMicrotask(()=>{if(failAttach)this.readyState=3;this.dispatchEvent(new Event(failAttach?'error':'open'));});}
  send(raw){const {id,method,params}=JSON.parse(raw);calls.push({method,params});let result={};
   if(method==='Page.getFrameTree')result={frameTree:{frame:{url:page.url}}};
   if(method==='Page.captureScreenshot')result={data:'image'};
   if(method==='Runtime.evaluate')result={result:{value:'text'}};
   queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id,result})})));
  }
  close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
 }
 const browser=virtualBrowser('/test/isolated-profile',{
  fileSystem:{existsSync:()=>true,mkdirSync:directory=>profiles.push(directory)},
  Socket,debugPort:async()=>9222,wait:async()=>{},
  spawnProcess:(binary,args)=>{
   const child=new EventEmitter();child.exitCode=null;child.signalCode=null;
   child.exit=()=>{child.exitCode=0;child.emit('exit',0);};child.kill=()=>{child.killed=true;if(!deferKill)child.exit();};
   children.push(child);assert(args.includes('--user-data-dir=/test/isolated-profile'));
   if(currentMode==='exit')queueMicrotask(child.exit);
   if(currentMode==='spawnError')queueMicrotask(()=>child.emit('error',Error('spawn failed')));
   return child;
  },
  fetchURL:async url=>{
   if(url.endsWith('/json/version')){if(currentMode==='timeout')throw Error('not ready');return {ok:true,json:async()=>({webSocketDebuggerUrl:'ws://127.0.0.1:9222'})};}
   if(failList)throw Error('disconnected');
   return {ok:true,json:async()=>[page]};
  },
 });
 return {browser,children,profiles,calls,ready:()=>{currentMode='ready';failAttach=false;failList=false;},disconnect:()=>{failList=true;}};
}

test('background reads and resize never start Chrome; concurrent opens reuse one session',async()=>{
 const h=harness();
 for(const action of ['screenshot','status','text','resize'])await assert.rejects(h.browser.action({action,width:1280,height:800}),/Abrir navegador/);
 assert.equal(h.children.length,0);
 await Promise.all(Array.from({length:8},()=>h.browser.action({action:'open'})));
 await Promise.all(['screenshot','status','resize','open'].map(action=>h.browser.action({action,width:1280,height:800})));
 assert.equal(h.children.length,1);assert.deepEqual(h.profiles,['/test/isolated-profile']);h.browser.close();
});

for(const mode of ['timeout','exit','spawnError'])test(`${mode}: polling, queued requests and agent retries cannot relaunch; explicit retry can`,async()=>{
 const h=harness({mode});
 const results=await Promise.allSettled(Array.from({length:8},()=>h.browser.action({action:'open'})));
 assert(results.every(result=>result.status==='rejected'));assert.equal(h.children.length,1);
 for(let i=0;i<5;i++)for(const action of ['screenshot','status','navigate'])await assert.rejects(h.browser.action({action,url:'https://example.com'},action==='navigate'?'agent':'user'));
 assert.equal(h.children.length,1);
 h.ready();await h.browser.action({action:'open'});assert.equal(h.children.length,2);
 assert.deepEqual(h.profiles,['/test/isolated-profile','/test/isolated-profile']);h.browser.close();
});

test('concurrent agent navigations initialize once; closed browser only reopens deliberately',async()=>{
 const h=harness();await Promise.all(Array.from({length:5},()=>h.browser.action({action:'navigate',url:'https://example.com'},'agent')));
 assert.equal(h.children.length,1);h.children[0].exit();
 for(const action of ['screenshot','status','navigate'])await assert.rejects(h.browser.action({action,url:'https://example.com'},'agent'));
 assert.equal(h.children.length,1);await h.browser.action({action:'open'});assert.equal(h.children.length,2);h.browser.close();
});

test('failed attachment and lost page connection reuse the live process without spawning another',async()=>{
 const h=harness({attachFails:true});await assert.rejects(h.browser.action({action:'open'}),/conectar/);
 await assert.rejects(h.browser.action({action:'screenshot'}));assert.equal(h.children.length,1);
 h.ready();await h.browser.action({action:'open'});assert.equal(h.children.length,1);
 h.disconnect();for(const action of ['screenshot','open','navigate'])await assert.rejects(h.browser.action({action,url:'https://example.com'}));
 assert.equal(h.children.length,1);h.ready();await h.browser.action({action:'open'});assert.equal(h.children.length,1);h.browser.close();
});

test('retry waits for an owned process to exit after startup timeout',async()=>{
 const h=harness({mode:'timeout',deferKill:true});
 await assert.rejects(h.browser.action({action:'open'}));
 assert.equal(h.children[0].killed,true);h.ready();
 await assert.rejects(h.browser.action({action:'open'}));assert.equal(h.children.length,1);
 h.children[0].exit();await h.browser.action({action:'open'});assert.equal(h.children.length,2);h.browser.close();h.children[1].exit();
});

for(const action of ['takeover','click','type','key','scroll','back','reload','text','switchTab','closeTab','clipboardCopy'])test(`${action}: failed connection does not acquire manual control`,async()=>{
 const h=harness();await assert.rejects(h.browser.action({action,text:'hello',key:'Enter',targetId:'page'}),/Abrir navegador/);
 assert.equal(h.children.length,0);
 const result=await h.browser.action({action:'navigate',url:'https://example.com'},'agent');
 assert.equal(result.manual,false);assert.equal(h.children.length,1);h.browser.close();
});

test('panel takeover failures preserve backend/UI control and allow later takeover and release',async()=>{
 const h=harness(),buttons=[];
 const context={manual:false,status:{},t:x=>x,icon:()=>({}),act:input=>h.browser.action(input),
  button:(label,onclick)=>{const button={onclick,disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;},append:()=>{}};buttons.push(button);return button;},
 };
 vm.createContext(context);
 context.capture=async()=>{context.manual=(await h.browser.action({action:'status'})).manual;vm.runInContext('paintControl()',context);};
 const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const start=source.indexOf(' const controlToggle=button('),end=source.indexOf(' const browserTabs=',start);
 vm.runInContext(source.slice(start,end),context);const toggle=buttons[0];
 for(let i=0;i<2;i++){
  await toggle.onclick();assert.equal(toggle.disabled,false);assert.equal(context.manual,false);
  assert.equal(toggle.attributes['aria-checked'],'false');assert.match(context.status.textContent,/Abrir navegador/);
 }
 assert.equal(h.children.length,0);
 const result=await h.browser.action({action:'navigate',url:'https://example.com'},'agent');assert.equal(result.manual,false);assert.equal(h.children.length,1);
 await toggle.onclick();assert.equal(context.manual,true);assert.equal(toggle.attributes['aria-checked'],'true');
 assert.equal((await h.browser.action({action:'status'})).manual,true);
 await assert.rejects(h.browser.action({action:'navigate',url:'https://example.com'},'agent'),/usuário está controlando/);
 await toggle.onclick();assert.equal(context.manual,false);assert.equal(toggle.attributes['aria-checked'],'false');
 assert.equal((await h.browser.action({action:'status'})).manual,false);assert.equal(h.children.length,1);h.browser.close();
});

test('failed user navigation startup and lost-session interactions leave agents in control',async()=>{
 const h=harness({mode:'timeout'});
 await assert.rejects(h.browser.action({action:'navigate',url:'https://example.com'}));
 h.ready();assert.equal((await h.browser.action({action:'open'})).manual,false);
 h.disconnect();
 for(const action of ['takeover','click'])await assert.rejects(h.browser.action({action}));
 h.ready();assert.equal((await h.browser.action({action:'navigate',url:'https://example.com'},'agent')).manual,false);
 assert.equal(h.children.length,2);h.browser.close();
});
