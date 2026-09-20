import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
for(const name of ['sw.js','public-sw.js'])test(name+' caches generic fallback only and recovers navigation without caching private responses',async()=>{
 const handlers={},stored=new Map();let offline=false,reply=new Response('private page'),shown;
 const caches={open:async()=>({put:async(key,response)=>stored.set(key,response)}),keys:async()=>[],match:async key=>stored.get(key)?.clone(),delete:async()=>true};
 const ctx={URL,Promise,caches,fetch:async path=>{if(offline)throw Error('offline');return typeof path==='string'?new Response(path):reply;},self:{location:{origin:'https://example.com'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}},registration:{showNotification:async(_,data)=>shown=data},navigator:{}}};
 vm.runInNewContext(read(name),ctx);let work;handlers.install({waitUntil:p=>work=p});await work;
 assert(stored.has('/offline.html'));assert(stored.has('/mascot-crying.svg'));assert(!stored.has('/'));assert(!stored.has('/config.js'));
 const request=(path,mode='cors')=>{let response;handlers.fetch({request:{method:'GET',url:'https://example.com'+path,mode},respondWith:p=>response=p});return response;};
 assert.equal(request('/api/state'),undefined);assert.equal(request('/config.js'),undefined);assert.equal(await (await request('/','navigate')).text(),'private page');assert(!stored.has('/'));
 offline=true;assert.equal(await (await request('/','navigate')).text(),'/offline.html');assert.equal(await (await request('/mascot-crying.svg')).text(),'/mascot-crying.svg');
 offline=false;reply=new Response('gateway down',{status:502});assert.equal(await (await request('/','navigate')).text(),'/offline.html');
 reply=new Response('',{status:303,headers:{Location:'/public/login'}});assert.equal((await request('/','navigate')).status,303);
 handlers.push({data:{json:()=>({conversation:'thread:synthetic',body:'Task waiting'})},waitUntil:p=>work=p});await work;assert.equal(shown.data.conversation,'thread:synthetic');
});
function boot({fallback=false,installed=true,online=true}={}){
 const handlers={},docHandlers={},nodes={img:{removeAttribute(name){delete this[name];}},h1:{},p:{},button:{}},screen={hidden:true,dataset:{},querySelector:key=>nodes[key]},workspace={};const timers=[];
 const ctx={document:{getElementById:()=>screen,body:{dataset:{offline:String(fallback)}},documentElement:{lang:'pt'},querySelector:()=>workspace,addEventListener:(name,fn)=>docHandlers[name]=fn,hidden:false},navigator:{onLine:online,languages:['pt-BR']},matchMedia:()=>({matches:installed}),localStorage:{getItem:()=>null},addEventListener:(name,fn)=>handlers[name]=fn,setTimeout:fn=>timers.push(fn),clearTimeout(){},setInterval:fn=>timers.push(fn),dispatchEvent(){},Event,AbortSignal,fetch:async()=>({ok:true}),location:{hash:'#conversation=gm',replace:value=>ctx.destination=value}};
 vm.runInNewContext(read('boot.js'),ctx);return {ctx,screen,nodes,handlers,workspace};
}
test('installed boot shows loading, crying offline, loading on reconnect, then releases the app',()=>{
 const {ctx,screen,nodes,handlers,workspace}=boot();assert.equal(screen.dataset.state,'loading');assert.equal(nodes.img.src,'/mascot.svg');assert(workspace.inert);
 ctx.CODEXBOT_BOOT.attach();ctx.navigator.onLine=false;handlers.offline();assert.equal(nodes.img.src,'/mascot-crying.svg');assert.equal(screen.dataset.state,'offline');
 ctx.navigator.onLine=true;handlers.online();assert.equal(screen.dataset.state,'loading');ctx.CODEXBOT_BOOT.ready();assert(screen.hidden);assert(!workspace.inert);assert.equal(nodes.img.src,undefined);
});
test('offline fallback can load without the app and retry preserves its offline state until reachable',async()=>{
 const {ctx,screen,nodes,handlers}=boot({fallback:true,online:false});assert.equal(screen.dataset.state,'offline');nodes.button.onclick();assert.equal(screen.dataset.state,'offline');ctx.navigator.onLine=true;handlers.online();assert.equal(screen.dataset.state,'loading');await new Promise(r=>setImmediate(r));assert.equal(ctx.destination,'/#conversation=gm');
 assert(boot({installed:false}).screen.hidden);
});
