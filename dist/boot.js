/* This screen contains no account data and is available from the offline cache. */
(()=>{
 const screen=document.getElementById('boot-screen');if(!screen)return;
 const fallback=document.body.dataset.offline==='true';
 const standalone=()=>fallback||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const mascot=screen.querySelector('img'),title=screen.querySelector('h1'),detail=screen.querySelector('p'),retry=screen.querySelector('button');
 let preference='auto';try{preference=localStorage.getItem('equipe-language')||'auto';}catch{}
 const language=['pt','en','es'].includes(preference)?preference:(navigator.languages||[navigator.language]).map(value=>String(value).slice(0,2)).find(value=>['pt','en','es'].includes(value))||'en';
 document.documentElement.lang=language;
 const words={pt:['Carregando seu espaço','Sua equipe já vem.','Estamos sem conexão','Vamos reconectar assim que seu dispositivo alcançar o Mac.','Tentar novamente'],en:['Loading your space','Your team will be right here.','We’re offline','We’ll reconnect as soon as your device can reach the Mac.','Try again'],es:['Cargando tu espacio','Tu equipo ya viene.','Sin conexión','Volveremos cuando tu dispositivo pueda conectarse al Mac.','Reintentar']}[language]||['Carregando seu espaço','Sua equipe já vem.','Estamos sem conexão','Vamos reconectar assim que seu dispositivo alcançar o Mac.','Tentar novamente'];
 let attached=false,phase='',probing=false;
 function show(next){
  if(!standalone()||phase===next)return;phase=next;screen.hidden=next==='ready';
  const workspace=document.querySelector('.workspace');if(workspace)workspace.inert=!screen.hidden;
  if(screen.hidden){mascot.removeAttribute('src');return;}
  const offline=next==='offline';mascot.src=offline?'/mascot-crying.svg':'/mascot.svg';
  title.textContent=words[offline?2:0];detail.textContent=words[offline?3:1];retry.textContent=words[4];retry.hidden=!offline;
  screen.dataset.state=next;
 }
 async function probe(){
  if(attached||probing||document.hidden)return;if(navigator.onLine===false){show('offline');return;}
  probing=true;
  try{const response=await fetch('/health',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(6000)});
   if(response.ok||response.status===401||response.status===403){show('loading');location.replace('/'+location.hash);}
   else show('offline');
  }catch{show('offline');}finally{probing=false;}
 }
 globalThis.CODEXBOT_BOOT={attach(){attached=true;clearTimeout(watchdog);},ready(){show('ready');},offline(){show('offline');},loading(){if(phase==='offline')show('loading');}};
 retry.onclick=()=>{show('loading');if(attached)dispatchEvent(new Event('codebox-retry'));else void probe();};
 addEventListener('offline',()=>show('offline'));
 addEventListener('online',()=>{if(phase==='offline')show('loading');if(!attached)void probe();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)mascot.removeAttribute('src');else{const current=phase;phase='';show(current);if(!attached)void probe();}});
 show(fallback||navigator.onLine===false?'offline':'loading');
 const watchdog=setTimeout(()=>{if(!attached){show('offline');void probe();}},15000);
 setInterval(()=>{if(!attached&&phase!=='ready')void probe();},5000);
})();
