export function recoveryDialog({scope,agentId,name,api,el,button,t,openDialog,close,refresh}){
 const box=el('div'),status=el('p',{role:'status'},t('Consultando tarefas…')),actions=el('div',{class:'actions'});
 const title=scope==='all'?t('Destravar todos os agentes'):t('Destravar {name}',{name});
 box.append(el('p',{},scope==='all'?t('Cancela as tarefas atuais de todos os agentes e reinicia o executor. Conversas, arquivos, agentes e configurações serão preservados.'):t('Cancela as tarefas atuais deste agente, incluindo threads e canais. Conversas, arquivos e configurações serão preservados.')),
  el('p',{},t('Ações externas já realizadas não são desfeitas. Rotinas futuras continuam ativas.')),status,actions);
 let plan=null,busy=false;
 const confirm=button(t('Confirmar recuperação'),async()=>{
  if(busy||!plan)return;busy=true;confirm.disabled=true;cancel.disabled=true;status.textContent=t('Recuperando… Aguarde a confirmação antes de enviar outra mensagem.');
  try{
   const result=await api('recovery',{action:'recover',scope,...(scope==='agent'?{agentId}:{}),jobIds:plan.jobIds,confirmed:true});
   await refresh();plan=null;
   status.textContent=result.error?t(result.error):result.remaining?t('Ainda há tarefas sem confirmação de parada. Use a recuperação global nas preferências para reiniciar o executor.'):t('Conversa liberada. Você já pode enviar uma nova mensagem.');
   confirm.hidden=true;cancel.textContent=t('Fechar');
  }catch(error){status.textContent=t(error.message);plan=null;reload.hidden=false;confirm.hidden=true;}
  finally{busy=false;cancel.disabled=false;}
 });
 const cancel=button(t('Cancelar'),()=>{if(!busy)close();});
 const reload=button(t('Revisar tarefas novamente'),()=>load());reload.hidden=true;
 async function load(){
  confirm.disabled=true;confirm.hidden=false;reload.hidden=true;status.textContent=t('Consultando tarefas…');
  try{plan=await api('recovery',{action:'preview',scope,...(scope==='agent'?{agentId}:{})});
   status.textContent=t('{queued} na fila · {running} em execução · {waiting} aguardando revisão',plan);
   if(!plan.jobIds.length&&scope==='agent'){status.textContent=t('Este agente não tem tarefas pendentes.');return;}
   confirm.disabled=false;
  }catch(error){plan=null;status.textContent=t(error.message);reload.hidden=false;}
 }
 confirm.disabled=true;actions.append(cancel,confirm,reload);box.append(actions);openDialog(title,box);void load();return box;
}
