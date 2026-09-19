// Native fullscreen when supported; an edge-to-edge viewport on mobile/webviews.
export function browserFullscreen({shell,button,t,doc=document}){
 let active=false,native=false,busy=false,marker=null,background=[];
 function paint(){const label=t(active?'Sair da tela cheia':'Tela cheia');button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(active));}
 function restore(){
  active=false;native=false;shell.classList.remove('browser-fullscreen');doc.body.classList.remove('browser-fullscreen-open');
  for(const [element,inert] of background)element.inert=inert;background=[];
  if(marker){marker.replaceWith(shell);marker=null;}
  paint();button.focus();
 }
 async function toggle(){
  if(busy)return;busy=true;
  try{
   if(active){if(doc.fullscreenElement===shell)await doc.exitFullscreen();if(active)restore();return;}
   marker=doc.createComment('browser position');shell.replaceWith(marker);doc.body.append(shell);
   background=[...doc.body.children].filter(element=>element!==shell).map(element=>[element,element.inert]);for(const [element] of background)element.inert=true;
   active=true;shell.classList.add('browser-fullscreen');doc.body.classList.add('browser-fullscreen-open');paint();button.focus();
   if(shell.requestFullscreen){try{await shell.requestFullscreen();native=doc.fullscreenElement===shell;}catch{/* The viewport fallback remains usable if the host disallows native fullscreen. */}}
  }finally{busy=false;}
 }
 doc.addEventListener('fullscreenchange',()=>{if(doc.fullscreenElement===shell)native=true;else if(active&&native)restore();});
 doc.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();void toggle().catch(()=>{});}},true);
 paint();return {toggle};
}
