import {liveVoiceControl} from './live-voice.js';
import {t,currentLanguage} from './i18n.mjs';
export function setupVoice({api,upload,el,button,openDialog,toast,target,accept}){
 const live=button('',async()=>{try{await startLive(target());}catch(e){toast(e.message);}},'icon-button voice-launch live-voice-launch');
 const updateLive=active=>{const label=t(active?'Encerrar conversa por voz':'Iniciar conversa por voz');live.title=label;live.setAttribute('aria-label',label);live.setAttribute('aria-pressed',String(active));live.classList.toggle('active',active);};
 const startLive=liveVoiceControl({api,el,button,toast,onState:updateLive});updateLive(false);
 live.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></svg>';
 const launch=button('',open,'icon-button voice-launch');launch.title=t('Mensagem por voz');launch.setAttribute('aria-label',t('Mensagem por voz'));
 launch.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
 document.querySelector('.attach-button').after(launch,live);
 async function open(){
  const destination=target(),box=el('div'),status=el('p',{'aria-live':'polite'},t('Verificando transcrição local…')),actions=el('div',{class:'actions'}),preview=el('textarea',{'aria-label':t('Transcrição'),'rows':'5'});preview.hidden=true;
  box.append(el('img',{src:'/mascot.svg',class:'voice-mascot',alt:''}),el('p',{},t('Grave até 3 minutos. O Mac transcreve o áudio localmente; você revisa antes de enviar.')),status,actions,preview);openDialog(t('Mensagem por voz'),box);
  let recorder,stream,timer,ticker,cancelled=false,processing=false,recording=false,chunks=[],started=0;
  const dialog=document.querySelector('#dialog');
  const release=()=>{clearTimeout(timer);clearInterval(ticker);stream?.getTracks().forEach(t=>t.stop());};
  const cleanup=()=>{cancelled=true;if(recorder?.state==='recording')recorder.stop();release();document.removeEventListener('visibilitychange',hidden);};
  const hidden=()=>{if(document.hidden&&recording)stop();};
  dialog.addEventListener('close',cleanup,{once:true});document.addEventListener('visibilitychange',hidden);
  const record=button(t('Gravar'),async()=>{if(recording)return stop();try{
   if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw Error(t('Use a opção de escolher um áudio neste navegador.'));
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});if(cancelled){release();return;}
   chunks=[];const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=()=>{release();recording=false;record.disabled=false;status.textContent=t('Não foi possível gravar. Escolha um arquivo de áudio.');};
   recorder.onstop=()=>{release();recording=false;if(!cancelled)void transcribe(new Blob(chunks,{type:recorder.mimeType}));};
   recorder.start(1000);recording=true;started=Date.now();record.textContent=t('Parar e transcrever');file.disabled=choose.disabled=true;
   const tick=()=>{status.textContent=t('Gravando…')+' '+Math.floor((Date.now()-started)/1000)+'s / 180s';};tick();ticker=setInterval(tick,1000);timer=setTimeout(stop,180000);
  }catch(e){release();status.textContent=e.name==='NotAllowedError'?t('Permita o microfone ou escolha um arquivo de áudio.'):e.message;}},'primary');
  function stop(){if(recorder?.state==='recording'){record.disabled=true;recorder.stop();}}
  const file=el('input',{type:'file',accept:'audio/*','aria-label':t('Escolher áudio')});file.onchange=()=>{if(file.files[0])void transcribe(file.files[0]);};
  async function transcribe(blob){if(processing||cancelled)return;if(blob.size>12*1024*1024){status.textContent=t('Áudio muito grande. Use até 12 MB e 3 minutos.');record.disabled=false;file.disabled=choose.disabled=false;return;}
   processing=true;record.disabled=true;file.disabled=choose.disabled=true;status.textContent=t('Transcrevendo no Mac…');box.classList.add('transcribing');
   try{const result=await upload(blob,currentLanguage());if(cancelled)return;preview.value=result.text;preview.hidden=false;status.textContent=t('Revise o texto e adicione à mensagem.');use.hidden=false;}
   catch(e){if(!cancelled)status.textContent=t(e.message);}
   finally{processing=false;box.classList.remove('transcribing');record.disabled=false;record.textContent=t('Gravar novamente');file.disabled=choose.disabled=false;}
  }
  const use=button(t('Adicionar à mensagem'),()=>{if(!preview.value.trim())return;accept(destination,preview.value.trim());dialog.close();toast(t('Transcrição adicionada ao rascunho.'));},'primary');use.hidden=true;
  file.hidden=true;const choose=button(t('Escolher áudio'),()=>file.click());actions.append(record,choose);box.append(file,use);
  record.disabled=true;file.disabled=choose.disabled=true;
  try{const result=await api('voice/status');if(cancelled)return;if(!result.available){status.textContent=t('Instale a transcrição local no Mac: npm run setup:voice');return;}status.textContent=t('Pronto para ouvir.');record.disabled=false;file.disabled=choose.disabled=false;record.click();}catch(e){status.textContent=t(e.message);}
 }
}
