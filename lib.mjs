import {timingSafeEqual} from 'node:crypto';
export function sameSecret(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
export function fieldMatches(expr,n,min,max){return expr.split(',').some(part=>{const [range,stepText]=part.split('/');const step=stepText===undefined?1:Number(stepText);if(!Number.isInteger(step)||step<1)return false;let lo,hi;if(range==='*'){lo=min;hi=max;}else if(range.includes('-'))[lo,hi]=range.split('-').map(Number);else lo=hi=Number(range);return Number.isInteger(lo)&&Number.isInteger(hi)&&lo>=min&&hi<=max&&lo<=hi&&n>=lo&&n<=hi&&(n-lo)%step===0;});}
export function validCron(cron){const fields=cron.trim().split(/\s+/),ranges=[[0,59],[0,23],[1,31],[1,12],[0,6]];return fields.length===5&&fields.every((f,i)=>f.split(',').every(p=>{if(!/^(\*|\d+(-\d+)?)(\/\d+)?$/.test(p))return false;const [r,s]=p.split('/');if(s&&Number(s)<1)return false;const nums=r==='*'?ranges[i]:r.split('-').map(Number);return nums.every(n=>n>=ranges[i][0]&&n<=ranges[i][1])&&(nums.length<2||nums[0]<=nums[1]);}));}
export function scheduleSlot(cron,date=new Date()){if(!validCron(cron))return null;const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));const d=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday);const f=cron.split(/\s+/);const checks=[fieldMatches(f[0],+p.minute,0,59),fieldMatches(f[1],+p.hour,0,23),fieldMatches(f[2],+p.day,1,31),fieldMatches(f[3],+p.month,1,12),fieldMatches(f[4],d,0,6)];const dayMatch=f[2]!=='*'&&f[4]!=='*'?(checks[2]||checks[4]):(checks[2]&&checks[4]);return checks[0]&&checks[1]&&checks[3]&&dayMatch?`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`:null;}
export function originAllowed(origin,site,port,remote=null){return !origin||[site,`http://127.0.0.1:${port}`,`http://localhost:${port}`,remote].filter(Boolean).includes(origin);}
export function safeText(x,max=32000){if(typeof x!=='string'||!x.trim()||x.length>max)throw Error('Texto vazio ou maior que o limite.');return x.trim();}

// Only a loopback-bound Serve proxy for the exact configured owner can authorize remote access.
export function remoteAuthorized(request,config){
 if(!config?.origin||!config?.login)return false;
 return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.address)&&request.host===new URL(config.origin).host&&request.login===config.login;
}
export function recordTurnError(job,event){
 job.lastTransportError=event.error?.message||'A execução não respondeu.';
 job.recovering=event.willRetry===true;
 // Protocol errors may be followed by a successful retry. Only turn/completed is terminal.
}
export function completeTurn(job,turn){
 job.status=turn?.status==='completed'?'completed':turn?.status==='interrupted'?'interrupted':'failed';
 if(job.status==='completed'){delete job.error;delete job.lastTransportError;}
 else job.error=turn?.error?.message||job.lastTransportError||job.error||'A execução terminou sem concluir. Revise antes de tentar novamente.';
 delete job.recovering;
}
