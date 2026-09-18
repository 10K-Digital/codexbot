import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
export function virtualBrowser(directory){
 let child,socket,starting,seq=0,manualUntil=0,lastURL='',navigationError=null,mainFrame=null;const requests=new Map();let port,activeId=null,known=new Set(),pages=[],queue=Promise.resolve();const pageState=new Map(),returnTo=new Map();
 async function rpc(method,params={}){if(!socket||socket.readyState!==1)throw Error('Navegador desconectado.');return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{requests.delete(id);reject(Error('O navegador demorou para responder.'));},15000);requests.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
 async function start(){if(child&&child.exitCode===null&&port){await syncPages();return;}if(starting)return starting;starting=(async()=>{
 const binary='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';if(!fs.existsSync(binary))throw Error('Google Chrome não está instalado.');
 fs.mkdirSync(directory,{recursive:true,mode:0o700});const portFile=path.join(directory,'DevToolsActivePort');fs.rmSync(portFile,{force:true});
 child=spawn(binary,['--start-minimized','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+directory,'--no-first-run','--no-default-browser-check','--window-size=1280,800','about:blank'],{stdio:'ignore'});
 child.on('error',()=>{});child.on('exit',()=>{socket?.close();socket=null;});
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('O navegador não iniciou.');if(fs.existsSync(portFile)){port=Number(fs.readFileSync(portFile,'utf8').split('\n')[0]);break;}await new Promise(r=>setTimeout(r,100));}if(!port)throw Error('Não foi possível iniciar o navegador.');
 const found=await listPages();const page=found[0];if(!page)throw Error('Nenhuma aba disponível.');known=new Set(found.map(p=>p.id));await attach(page);
 })().finally(()=>starting=null);return starting;}
 async function listPages(){const r=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Não foi possível listar as abas.');return (await r.json()).filter(p=>p.type==='page');}
 async function attach(page){
 if(activeId)pageState.set(activeId,{lastURL,navigationError,mainFrame});socket?.close();const saved=pageState.get(page.id)||{};lastURL=saved.lastURL||page.url;navigationError=saved.navigationError||null;mainFrame=saved.mainFrame||null;activeId=page.id;
 socket=new WebSocket(page.webSocketDebuggerUrl);const attached=socket;await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',()=>reject(Error('Falha ao conectar ao navegador.')),{once:true});});
 socket.addEventListener('message',event=>{if(socket!==attached)return;const x=JSON.parse(event.data);if(x.method==='Network.responseReceived'&&x.params.type==='Document'&&(!mainFrame||x.params.frameId===mainFrame)){const response=x.params.response;if(response.status>=400)navigationError='HTTP '+response.status;else navigationError=null;}if(x.method==='Page.frameNavigated'&&!x.params.frame.parentId)mainFrame=x.params.frame.id;const r=requests.get(x.id);if(r){requests.delete(x.id);clearTimeout(r.timer);x.error?r.reject(Error(x.error.message)):r.resolve(x.result);}});
 socket.addEventListener('close',()=>{if(socket!==attached)return;for(const r of requests.values()){clearTimeout(r.timer);r.reject(Error('Navegador desconectado.'));}requests.clear();});
 await rpc('Page.enable');await rpc('Network.enable');await rpc('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 }
 async function syncPages(followNew=true){const current=await listPages();if(!current.length)throw Error('Nenhuma aba disponível.');const opened=current.filter(p=>!known.has(p.id));for(const p of opened)returnTo.set(p.id,activeId);known=new Set(current.map(p=>p.id));pages=current;const selected=(followNew&&opened.length?opened[0]:null)||current.find(p=>p.id===activeId)||current.find(p=>p.id===returnTo.get(activeId))||current[0];if(selected.id!==activeId||socket?.readyState!==1)await attach(selected);}
 async function action(input,actor='user'){
 const op=input.action;if(op==='release'){manualUntil=0;return {ok:true};}if(op==='takeover'){manualUntil=Number.MAX_SAFE_INTEGER;await start();return {ok:true};}
 if(actor==='agent'&&manualUntil>Date.now())throw Error('O usuário está controlando o navegador. Aguarde a liberação no painel.');
 if(actor==='user'&&!['screenshot','status'].includes(op))manualUntil=Number.MAX_SAFE_INTEGER;
 await start();await syncPages(op==='screenshot'||op==='status');
 if(op==='switchTab'){const page=pages.find(p=>p.id===input.targetId);if(!page)throw Error('A aba foi fechada.');await attach(page);await rpc('Page.bringToFront');}
 else if(op==='closeTab'){if(pages.length<2)throw Error('Mantenha pelo menos uma aba aberta.');if(!pages.some(p=>p.id===input.targetId))throw Error('A aba foi fechada.');await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(input.targetId)}`,{signal:AbortSignal.timeout(5000)});await syncPages(false);}
 else if(input.targetId&&input.targetId!==activeId)throw Error('A aba mudou. Aguarde a tela atualizar antes de interagir.');
 if(op==='navigate'){const url=new URL(input.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Use um endereço HTTP ou HTTPS.');lastURL=url.href;navigationError=null;const result=await rpc('Page.navigate',{url:url.href});if(result.errorText)navigationError=result.errorText;}
 else if(op==='click'){const x=Math.max(0,Math.min(Number(input.x)||0,1279)),y=Math.max(0,Math.min(Number(input.y)||0,799));await rpc('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
 else if(op==='type'){if(typeof input.text!=='string'||input.text.length>20000)throw Error('Texto inválido.');await rpc('Input.insertText',{text:input.text});}
 else if(op==='key'){const keys={Enter:13,Tab:9,Backspace:8,Escape:27,ArrowDown:40,ArrowUp:38,ArrowLeft:37,ArrowRight:39,Delete:46};if(!keys[input.key])throw Error('Tecla não suportada.');await rpc('Input.dispatchKeyEvent',{type:'keyDown',key:input.key,windowsVirtualKeyCode:keys[input.key]});await rpc('Input.dispatchKeyEvent',{type:'keyUp',key:input.key,windowsVirtualKeyCode:keys[input.key]});}
 else if(op==='scroll')await rpc('Input.dispatchMouseEvent',{type:'mouseWheel',x:Math.max(0,Math.min(Number(input.x)||640,1279)),y:Math.max(0,Math.min(Number(input.y)||400,799)),deltaX:Math.max(-1600,Math.min(Number(input.deltaX)||0,1600)),deltaY:Math.max(-1600,Math.min(Number(input.deltaY)||0,1600))});
 else if(op==='back'){const h=await rpc('Page.getNavigationHistory');if(h.currentIndex>0)await rpc('Page.navigateToHistoryEntry',{entryId:h.entries[h.currentIndex-1].id});}
 else if(op==='reload'){navigationError=null;if(lastURL)await rpc('Page.navigate',{url:lastURL});else await rpc('Page.reload');}
 else if(op==='text'){const r=await rpc('Runtime.evaluate',{expression:'document.body.innerText.slice(0,30000)',returnByValue:true});return {text:r.result.value};}
 else if(!['screenshot','status','switchTab','closeTab'].includes(op))throw Error('Ação desconhecida.');
 const tree=await rpc('Page.getFrameTree'),result={activeTargetId:activeId,tabs:pages.map(p=>({id:p.id,title:p.title||p.url||'Nova aba',url:p.url})),url:tree.frameTree.frame.url.startsWith('chrome-error:')?lastURL:tree.frameTree.frame.url,error:navigationError,manual:manualUntil>Date.now(),width:1280,height:800};if(op==='screenshot')result.image='data:image/jpeg;base64,'+(await rpc('Page.captureScreenshot',{format:'jpeg',quality:70})).data;return result;
 }
 return {action:(input,actor)=>{const result=queue.then(()=>action(input,actor));queue=result.catch(()=>{});return result;},close:()=>{socket?.close();child?.kill();}};
}
