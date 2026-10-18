const active=job=>['queued','running','waiting'].includes(job.status);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function createRecovery({state,agents,persist,interrupt,restart,timeoutMs=5000}){
 let busy=false;
 function targets({scope,agentId}){
  if(!['agent','all'].includes(scope)||scope==='agent'&&!agents.has(agentId))throw Error('Escolha um agente válido ou todos os agentes.');
  return state.jobs.filter(job=>active(job)&&(scope==='all'||job.agentId===agentId));
 }
 function preview(input){
  const jobs=targets(input);
  return {jobIds:jobs.map(job=>job.id),queued:jobs.filter(job=>job.status==='queued').length,running:jobs.filter(job=>job.status==='running').length,waiting:jobs.filter(job=>job.status==='waiting').length};
 }
 async function recover(input){
  if(busy)throw Error('Uma recuperação já está em andamento. Aguarde.');
  if(input.confirmed!==true)throw Error('Confirme o cancelamento das tarefas antes de continuar.');
  const jobs=targets(input),ids=input.jobIds;
  if(!Array.isArray(ids)||ids.length!==jobs.length||new Set(ids).size!==ids.length||jobs.some(job=>!ids.includes(job.id)))throw Error('A fila mudou. Revise as tarefas novamente antes de confirmar.');
  busy=true;
  try{
   // Mark the whole confirmed batch before awaiting: cancelling a predecessor
   // must never dispatch another task from that same batch.
   for(const job of jobs){job.cancelRequested=true;if(job.status==='queued'){job.status='interrupted';job.finishedAt=new Date().toISOString();}}
   persist();let error=null;
   if(input.scope==='all'){
    try{await restart();}catch{error='Não foi possível reconectar o executor. Verifique a conexão e tente novamente.';}
   }else{
    const deadline=Date.now()+timeoutMs;
    const stop=Promise.allSettled(jobs.filter(active).map(job=>interrupt(job)));
    let timer;await Promise.race([stop,new Promise(resolve=>{timer=setTimeout(resolve,timeoutMs);})]);clearTimeout(timer);
    while(jobs.some(active)&&Date.now()<deadline)await pause(Math.min(100,deadline-Date.now()));
   }
   persist();return {stopped:jobs.filter(job=>!active(job)).length,remaining:jobs.filter(active).length,reconnected:input.scope==='all'&&!error,error};
  }finally{busy=false;}
 }
 return {preview,recover,get busy(){return busy;}};
}
