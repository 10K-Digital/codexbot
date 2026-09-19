// Edge-to-edge application fullscreen also works in webviews and mobile browsers.
export function browserFullscreen({shell,button,t,onChange=()=>{},doc=document}){
 let active=false,marker=null,background=[];
 function paint(){const label=t(active?'Sair da tela cheia':'Tela cheia');button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(active));}
 function restore(){
  active=false;shell.classList.remove('browser-fullscreen');doc.body.classList.remove('browser-fullscreen-open');
  for(const [element,inert] of background)element.inert=inert;background=[];
  if(marker){marker.replaceWith(shell);marker=null;}
  paint();button.focus();onChange(active);
 }
 function toggle(){
  if(active){restore();return;}
  marker=doc.createComment('browser position');shell.replaceWith(marker);doc.body.append(shell);
  background=[...doc.body.children].filter(element=>element!==shell).map(element=>[element,element.inert]);for(const [element] of background)element.inert=true;
  active=true;shell.classList.add('browser-fullscreen');doc.body.classList.add('browser-fullscreen-open');paint();button.focus();onChange(active);
 }
 doc.addEventListener('keydown',event=>{if(active&&event.key==='Escape'&&!shell.querySelector('dialog[open]')){event.preventDefault();event.stopImmediatePropagation();restore();}},true);
 paint();return {toggle};
}
