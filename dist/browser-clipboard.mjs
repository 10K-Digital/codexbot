export function setupBrowserClipboard({screen,act,capture,el,button,t,toast}){
 const panel=el('details',{class:'browser-clipboard'}),summary=el('summary',{},t('Clipboard compartilhado')),label=el('label',{},t('Texto para copiar ou colar')),text=el('textarea',{rows:3,maxlength:100000,autocomplete:'off',spellcheck:'false'}),status=el('p',{role:'status',class:'muted'}),actions=el('div',{class:'actions'});label.append(text);
 let busy=false;
 const message=key=>{status.textContent=t(key);};
 async function transfer(action,body){if(busy)throw Error(t('Aguarde a transferência atual.'));busy=true;try{return await act({action,...body});}finally{busy=false;}}
 function manual(error){panel.open=true;status.textContent=t('Use o campo abaixo para copiar ou colar manualmente.')+(error?' '+t(error.message):'');text.focus();text.select();}
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
 actions.append(button(t('Copiar seleção'),()=>copy()),button(t('Colar no navegador'),paste),button(t('Receber clipboard do Mac'),()=>copy(false)),button(t('Selecionar tudo'),async()=>{try{await transfer('selectAll');await capture();screen.focus();}catch(error){manual(error);}}));
 const fallback=el('div',{class:'actions'});fallback.append(button(t('Copiar este texto'),async()=>{try{await navigator.clipboard.writeText(text.value);message('Texto copiado para este dispositivo.');}catch(error){manual(error);}}),button(t('Colar este texto no navegador'),async()=>{try{await pasteValue(text.value);}catch(error){manual(error);}}),button(t('Limpar campo'),()=>{text.value='';status.textContent='';}));
 panel.append(summary,el('p',{class:'muted'},t('Somente texto. As transferências usam o clipboard do Mac e acontecem apenas quando você copia ou cola.')),el('p',{class:'muted'},t('Com a tela focada: Ctrl/Cmd+C para copiar, Ctrl/Cmd+V para colar e Ctrl/Cmd+A para selecionar tudo.')),actions,label,fallback,status);
 screen.addEventListener('keydown',event=>{if(!(event.ctrlKey||event.metaKey)||event.altKey)return;const key=event.key.toLowerCase();if(key==='c'){event.preventDefault();void copy();}else if(key==='v'){
  // Let native paste deliver clipboardData, including on browsers that deny readText.
 }else if(key==='a'){event.preventDefault();void transfer('selectAll').then(capture).catch(manual);}});
 screen.addEventListener('paste',event=>{const data=event.clipboardData;if(!data)return;event.preventDefault();if(![...data.types].includes('text/plain')){manual(Error(t('Cole texto; imagens e arquivos não são suportados neste clipboard.')));return;}void pasteValue(data.getData('text/plain')).catch(manual);});
 return panel;
}
