import {t} from './i18n.mjs';
export function liveVoiceControl({api,el,button,toast,onState=()=>{}}){
 let call=null;
 return async function start(agentId){
  if(call)return call.stop();
  if(agentId.startsWith('channel:'))throw Error(t('Selecione um agente para conversar por voz.'));
  if(!navigator.mediaDevices?.getUserMedia||!globalThis.RTCPeerConnection)throw Error(t('Use a opção de escolher um áudio neste navegador.'));
  const name=document.querySelector('#title').textContent;
  const c={closed:false,id:null,stream:null,pc:null,timer:null,timeout:null};call=c;
  const dock=el('div',{class:'voice-session',role:'region','aria-label':t('Conversa por voz')}),status=el('span',{'aria-live':'polite'},t('Conectando voz…')),audio=el('audio',{autoplay:'',playsinline:''});
  const stop=async()=>{if(c.closed)return;c.closed=true;clearInterval(c.timer);clearTimeout(c.timeout);c.stream?.getTracks().forEach(track=>track.stop());c.pc?.close();audio.pause();audio.srcObject=null;dock.remove();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',stop);if(call===c){call=null;onState(false);}if(c.id)try{await api('voice/live/stop',{sessionId:c.id});}catch{}};
  c.stop=stop;onState(true);
  const hidden=()=>{if(document.hidden)void stop();};
  const finish=button(t('Encerrar'),stop,'danger'),mute=button(t('Silenciar'),()=>{const track=c.stream?.getAudioTracks()[0];if(!track)return;track.enabled=!track.enabled;mute.textContent=t(track.enabled?'Silenciar':'Ativar microfone');mute.setAttribute('aria-pressed',String(!track.enabled));status.textContent=name+' · '+t(track.enabled?'Voz ao vivo · ouvindo':'Microfone silenciado');});mute.disabled=true;
  const listen=button(t('Ouvir áudio'),()=>audio.play());listen.hidden=true;
  dock.append(el('img',{src:'/mascot.svg',width:'36',height:'36',alt:''}),status,mute,listen,finish,audio);document.querySelector('#notice').after(dock);document.querySelector('#dialog').close();
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',stop);
  try{
   c.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});if(c.closed){c.stream.getTracks().forEach(track=>track.stop());return;}
   c.pc=new RTCPeerConnection();c.pc.ontrack=event=>{audio.srcObject=event.streams[0]||new MediaStream([event.track]);audio.play().catch(()=>listen.hidden=false);};
   c.pc.onconnectionstatechange=()=>{if(c.closed)return;const state=c.pc.connectionState;if(state==='connected'){clearTimeout(c.timeout);status.textContent=name+' · '+t('Voz ao vivo · ouvindo');mute.disabled=false;}else if(['failed','closed'].includes(state)){toast(t('A conexão de voz foi interrompida.'));void stop();}};
   c.stream.getTracks().forEach(track=>c.pc.addTrack(track,c.stream));c.pc.createDataChannel('oai-events');await c.pc.setLocalDescription(await c.pc.createOffer());
   if(c.closed)return;const answer=await api('voice/live/start',{agentId,sdp:c.pc.localDescription.sdp});c.id=answer.sessionId;if(c.closed){await api('voice/live/stop',{sessionId:c.id});return;}
   await c.pc.setRemoteDescription({type:'answer',sdp:answer.sdp});
   let heartbeatPending=false;c.timer=setInterval(async()=>{if(heartbeatPending||c.closed)return;heartbeatPending=true;try{await api('voice/live/heartbeat',{sessionId:c.id});}catch(e){toast(e.message);void stop();}finally{heartbeatPending=false;}},10000);
   if(c.pc.connectionState!=='connected')c.timeout=setTimeout(()=>{toast(t('A conexão de voz demorou. Tente a transcrição local.'));void stop();},20000);
  }catch(e){await stop();toast(e.name==='NotAllowedError'?t('Permita o microfone ou escolha um arquivo de áudio.'):e.message);}
 };
}
