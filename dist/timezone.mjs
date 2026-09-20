export const legacyTimezone='America/Sao_Paulo';
export function validTimezone(value){if(typeof value!=='string'||!value||value.length>100)throw Error('Fuso horário inválido.');try{return new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone;}catch{throw Error('Fuso horário inválido.');}}
export function detectedTimezone(){try{return validTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);}catch{return 'UTC';}}
export function localDateInput(at,timezone){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:validTimezone(timezone),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
export function localToInstant(value,timezone){
 const zone=validTimezone(timezone);
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Data inválida.');
 const guess=Date.parse(value+':00Z');if(!Number.isFinite(guess)||new Date(guess).toISOString().slice(0,16)!==value)throw Error('Data inválida.');
 const offsets=new Set();for(let h=-36;h<=36;h+=6){const at=guess+h*3600000;offsets.add(Date.parse(localDateInput(at,zone)+':00Z')-at);}
 const candidates=[...offsets].map(offset=>guess-offset).filter(at=>localDateInput(at,zone)===value).sort((a,b)=>a-b);
 if(!candidates.length)throw Error('Este horário não existe neste fuso devido à mudança de horário de verão. Escolha outro horário.');
 // During a repeated DST hour, schedule only the first occurrence.
 return new Date(candidates[0]).toISOString();
}
