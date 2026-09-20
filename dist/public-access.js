import {t} from './i18n.mjs';
export function publicAccessSettings({api,el,button}){
 const box=el('section',{class:'public-access-settings'}),message=el('p',{role:'status',class:'muted'});
 box.append(el('h3',{},t('Acesso remoto e senha')),el('p',{},t('Abra o Codebox pela internet sem Tailscale. O Mac precisa permanecer ligado.')),message);
 const fields=el('div');box.append(fields);let busy=false;
 async function load(){message.textContent=t('Verificando conexão…');try{draw(await api('public-access'));}catch(e){message.textContent=t(e.message);}}
 function draw(state){
  fields.replaceChildren();
  const phases={disabled:'Desativado',connecting:'Conectando ao Cloudflare',connected:'Conectado ao Cloudflare',reconnecting:'Reconectando ao Cloudflare','connector-missing':'Conector não instalado',error:'Não foi possível iniciar. Confira a porta do túnel.'};
  message.textContent=t(phases[state.status]||state.status);
  if(state.origin){const link=el('a',{href:state.origin,target:'_blank',rel:'noopener',class:'remote-link'},state.origin);fields.append(link);}
  if(!state.connectorInstalled){fields.append(button(t('Instalar conector Cloudflare'),async()=>{if(busy)return;busy=true;message.textContent=t('Instalando conector…');try{draw(await api('public-access',{action:'install'}));}finally{busy=false;}}));}
  const origin=el('input',{type:'url',id:'public-origin',placeholder:'https://meu-mac.example.com',autocomplete:'off'});origin.value=state.origin;
  const token=el('input',{type:'password',id:'public-token',autocomplete:'new-password',placeholder:state.tunnelConfigured?t('Já configurado; deixe vazio para manter'):t('Token fornecido para esta instalação')});
  const password=el('input',{type:'password',id:'public-password',autocomplete:'new-password',minlength:'12',maxlength:'256',placeholder:state.passwordSet?t('Deixe vazio para manter a senha'):t('Pelo menos 12 caracteres')});
  const confirm=el('input',{type:'password',id:'public-confirm',autocomplete:'new-password',maxlength:'256'});
  const enabled=el('input',{type:'checkbox',id:'public-enabled'});enabled.checked=state.enabled;
  fields.append(el('label',{for:'public-password'},t('Senha de acesso remoto')),password,el('label',{for:'public-confirm'},t('Confirmar nova senha')),confirm,el('p',{class:'muted'},t('Trocar a senha ou salvar as configurações encerra as sessões com senha abertas.')));
  const tailscale=el('input',{type:'checkbox',id:'tailscale-password'});tailscale.checked=state.requireTailscalePassword===true;
  const tailscaleLabel=el('label',{class:'public-enable',for:'tailscale-password'});tailscaleLabel.append(tailscale,el('span',{},t('Exigir senha também no Tailscale')));fields.append(tailscaleLabel,el('p',{class:'muted'},t('A mesma senha protege as duas conexões. O Tailscale continua exigindo a conta do proprietário.')));
  const advanced=el('details');advanced.open=!state.tunnelConfigured;
  advanced.append(el('summary',{},t('Configuração do túnel')),el('label',{for:'public-origin'},t('URL pública permanente')),origin,el('label',{for:'public-token'},t('Token do túnel Cloudflare')),token,el('p',{class:'muted'},t('Destino do túnel no Cloudflare: {target}',{target:'http://127.0.0.1:'+state.port})),el('p',{class:'muted'},t('Use um túnel dedicado a esta instalação. Nunca aponte o túnel para a porta local sem senha.')));
  const enableLabel=el('label',{class:'public-enable',for:'public-enabled'});enableLabel.append(enabled,el('span',{},t('Ativar acesso público')));fields.append(advanced,enableLabel);
  fields.append(button(t('Salvar acesso remoto'),async()=>{
   if(busy)return;if(password.value!==confirm.value)throw Error(t('As senhas não coincidem.'));
   busy=true;message.textContent=t('Salvando…');
   try{const saved=await api('public-access',{enabled:enabled.checked,requireTailscalePassword:tailscale.checked,...(origin.value.trim()?{origin:origin.value.trim()}:{}),password:password.value,tunnelToken:token.value.trim()});password.value='';confirm.value='';token.value='';draw(saved);}finally{busy=false;}
  },'primary'),button(t('Atualizar estado'),load));
  if(state.enabled)fields.append(button(t('Desativar agora'),async()=>{if(busy)return;busy=true;try{draw(await api('public-access',{enabled:false}));}finally{busy=false;}}));
 }
 void load();return box;
}
