export function setupBrowserClipboard({screen,act,capture,el,iconButton,t,toast}){
 const panel=el('dialog',{class:'browser-clipboard-dialog','aria-labelledby':'browser-clipboard-title'}),heading=el('h2',{id:'browser-clipboard-title'},t('Clipboard compartilhado')),header=el('div',{class:'browser-clipboard-heading'}),label=el('label',{},t('Texto para copiar ou colar')),text=el('textarea',{rows:3,maxlength:100000,autocomplete:'off',spellcheck:'false'}),status=el('p',{role:'status',class:'muted'}),actions=el('div',{class:'clipboard-actions',role:'group','aria-label':t('Navegador da equipe')});label.append(text);
 const trigger=iconButton('Clipboard compartilhado','clipboard',open);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
 function open(){if(!panel.open)panel.showModal();trigger.setAttribute('aria-expanded','true');}
 panel.addEventListener('close',()=>trigger.setAttribute('aria-expanded','false'));
 header.append(heading,iconButton('Fechar','close',()=>panel.close()));
 let busy=false;
 const message=key=>{status.textContent=t(key);};
 async function transfer(action,body){if(busy)throw Error(t('Aguarde a transferência atual.'));busy=true;try{return await act({action,...body});}finally{busy=false;}}
 function manual(error){open();status.textContent=t('Use o campo abaixo para copiar ou colar manualmente.')+(error?' '+t(error.message):'');text.focus();text.select();}
 async function remoteText(copy){const r=await transfer(copy?'clipboardCopy':'clipboardRead');text.value=r.text||'';return text.value;}
 async function copy(copySelection=true){
  try{
   // Start write during the user gesture; WebKit accepts a promised ClipboardItem.
   if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
    const pending=remoteText(copySelection);pending.catch(()=>{});
    try{await navigator.clipboard.write([new ClipboardItem({'text/plain':pending.then(value=>new Blob([value],{type:'text/plain'}))})]);}
    catch(error){await pending;manual(error);return;}
   }else{const value=await remoteText(copySelection);if(!navigator.clipboard?.writeText){manual();return;}await navigator.clipboard.writeText(value);}
   message('Texto copiado para este dispositivo.');toast(t('Texto copiado para este dispositivo.'));
  }catch(error){manual(error);}
 }
 async function pasteValue(value){text.value=value;await transfer('clipboardPaste',{text:value});message('Texto colado no navegador.');await capture();}
 async function paste(){try{if(!navigator.clipboard?.readText){manual();return;}await pasteValue(await navigator.clipboard.readText());}catch(error){manual(error);}}
 actions.append(iconButton('Copiar seleção','copy',()=>copy()),iconButton('Colar no navegador','paste',paste),iconButton('Receber clipboard do Mac','down',()=>copy(false)),iconButton('Selecionar tudo','selectAll',async()=>{try{await transfer('selectAll');await capture();if(!panel.open)screen.focus();}catch(error){manual(error);}}));
 const fallback=el('div',{class:'clipboard-actions',role:'group','aria-label':t('Texto para copiar ou colar')});fallback.append(iconButton('Copiar este texto','copy',async()=>{try{await navigator.clipboard.writeText(text.value);message('Texto copiado para este dispositivo.');}catch(error){manual(error);}}),iconButton('Colar este texto no navegador','paste',async()=>{try{await pasteValue(text.value);}catch(error){manual(error);}}),iconButton('Limpar campo','trash',()=>{text.value='';status.textContent='';}));
 panel.append(header,actions,label,fallback,status,el('p',{class:'muted clipboard-hint'},t('Somente texto. As transferências usam o clipboard do Mac e acontecem apenas quando você copia ou cola.')));
 screen.addEventListener('keydown',event=>{if(!(event.ctrlKey||event.metaKey)||event.altKey)return;const key=event.key.toLowerCase();if(key==='c'){event.preventDefault();void copy();}else if(key==='v'){
  // Let native paste deliver clipboardData, including on browsers that deny readText.
 }else if(key==='a'){event.preventDefault();void transfer('selectAll').then(capture).catch(manual);}});
 screen.addEventListener('paste',event=>{const data=event.clipboardData;if(!data)return;event.preventDefault();if(![...data.types].includes('text/plain')){manual(Error(t('Cole texto; imagens e arquivos não são suportados neste clipboard.')));return;}void pasteValue(data.getData('text/plain')).catch(manual);});
 return {trigger,panel};
}
