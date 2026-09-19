const days=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function scheduleToCron(s){
 if(!s||!['weekly','interval','monthly'].includes(s.kind))throw Error('Frequência inválida.');
 if(!integer(s.minute,0,59))throw Error('Minuto inválido.');
 let day='*',week='*',hour;
 if(s.kind==='monthly'){if(!integer(s.day,1,31))throw Error('Dia do mês inválido.');day=String(s.day);}
 else {if(!Array.isArray(s.days)||!s.days.length||s.days.some(n=>!integer(n,0,6)))throw Error('Selecione os dias da semana.');week=[...new Set(s.days)].sort().join(',');if(week==='0,1,2,3,4,5,6')week='*';}
 if(s.kind==='interval'){
  if(!integer(s.start,0,23)||!integer(s.end,s.start,23)||!integer(s.every,1,23))throw Error('Intervalo inválido.');
  hour=s.start===s.end?String(s.start):`${s.start}-${s.end}/${s.every}`;
 }else{
  if(!Array.isArray(s.hours)||!s.hours.length||s.hours.some(n=>!integer(n,0,23)))throw Error('Selecione pelo menos um horário.');hour=[...new Set(s.hours)].sort((a,b)=>a-b).join(',');
 }
 return `${s.minute} ${hour} ${day} * ${week}`;
}
function expand(v,min,max){const out=new Set();for(const part of v.split(',')){if(!/^(\*|\d+(-\d+)?)(\/\d+)?$/.test(part))return null;const [range,step='1']=part.split('/'),[a,b]=range==='*'?[min,max]:range.split('-').map(Number);if(+step<1||a<min||(b??a)>max||a>(b??a))return null;for(let n=a;n<=(b??a);n+=+step)out.add(n);}return [...out].sort((a,b)=>a-b);}
export function cronToSchedule(cron){
 const f=String(cron).trim().split(/\s+/);if(f.length!==5||f[3]!=='*'||!/^\d+$/.test(f[0])||+f[0]>59)return null;
 const d=expand(f[4],0,6),hours=expand(f[1],0,23);if(!d||!hours)return null;
 if(f[2]!=='*'){if(f[4]!=='*'||!/^\d+$/.test(f[2])||+f[2]<1||+f[2]>31)return null;return {kind:'monthly',day:+f[2],hours,minute:+f[0]};}
 const m=f[1].match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
 if(m)return {kind:'interval',days:d,start:+m[1],end:+m[2],every:+(m[3]||1),minute:+f[0]};
 return {kind:'weekly',days:d,hours,minute:+f[0]};
}
export function describeSchedule(cron,t=x=>x){const s=cronToSchedule(cron);if(!s)return t('Agendamento personalizado preservado');const period=s.kind==='monthly'?t('Dia {day} de cada mês').replace('{day}',s.day):s.days.length===7?t('Todos os dias'):s.days.map(n=>t(days[n])).join(', ');const time=h=>String(h).padStart(2,'0')+':'+String(s.minute).padStart(2,'0');return period+' · '+(s.kind==='interval'?t('A cada {every}h, de {start} a {end}').replace('{every}',s.every).replace('{start}',time(s.start)).replace('{end}',time(s.end)):s.hours.map(time).join(', '));}

export function onceDate(value,{future=false,now=Date.now()}={}){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw Error('Informe uma data e horário com fuso horário.');
 const date=new Date(value);if(!Number.isFinite(date.getTime())||(future&&date.getTime()<=now))throw Error('Escolha uma data e horário no futuro.');
 const day=value.slice(0,10);if(new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw Error('Data inválida.');
 return date.toISOString();
}
export function routineSchedule(r){return r.schedule?.kind==='once'?r.schedule:cronToSchedule(r.cron);}
export function describeRoutine(r,t=x=>x){return r.schedule?.kind==='once'?t('Uma única vez')+' · '+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(r.schedule.at)):describeSchedule(r.cron,t);}
export function saoPauloInput(at){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;}
