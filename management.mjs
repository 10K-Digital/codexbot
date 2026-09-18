import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
export const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function resolveTargets(text,agents,defaultIds){
 const names=agents.slice().sort((a,b)=>b.name.length-a.name.length),hits=new Set();
 for(const match of text.matchAll(/(?:^|\s)@/gu)){const rest=text.slice(match.index+match[0].length);const found=names.find(a=>rest.toLocaleLowerCase().startsWith(a.name.toLocaleLowerCase())&&(!rest[a.name.length]||/[\s,.;:!?]/u.test(rest[a.name.length])));if(found)hits.add(found.id);}
 return hits.size?[...hits]:[...new Set(defaultIds)];
}
export function management({catalog,state,root,persist,byAgent,resetAgent}){
 const catalogFile=path.join(root,'.private/catalog.json');const save=()=>{fs.writeFileSync(catalogFile+'.tmp',JSON.stringify(catalog,null,2),{mode:0o600});fs.renameSync(catalogFile+'.tmp',catalogFile);};
 const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Texto inválido.');return v.trim();};
 function agent(b){const name=text(b.name,80),description=text(b.description,32000);let existing=b.id?catalog.agents.find(a=>a.id===b.id):null;if(b.id&&!existing)throw Error('Agente não encontrado.');
 const id=existing?.id||slug(name)||'agente-'+randomUUID().slice(0,8);if(!existing&&byAgent.has(id))throw Error('Já existe um agente com esse nome.');
 const skills=Array.isArray(b.skills)?[...new Set(b.skills)]:[];if(skills.some(id=>!catalog.skills.some(s=>s.id===id)))throw Error('Skill desconhecida.');
 resetAgent(id);const a={...existing,id,name,description,skills,browser:b.browser===true};if(existing)Object.assign(existing,a);else catalog.agents.push(a);byAgent.set(id,existing||a);save();return a;
 }
 function skill(b){const name=text(b.name,120),description=text(b.description,1200),instructions=text(b.instructions,100000);const existing=b.id?catalog.skills.find(s=>s.id===b.id):null;if(b.id&&!existing)throw Error('Skill não encontrada.');
 const id=existing?.id||slug(name)||'skill-'+randomUUID().slice(0,8);if(!existing&&catalog.skills.some(s=>s.id===id))throw Error('Já existe uma skill com esse nome.');
 const dir=path.join(root,'.private/skills',id);fs.mkdirSync(dir,{recursive:true,mode:0o700});const target=path.join(dir,'SKILL.md');
 if(fs.existsSync(target)){const backup=path.join(root,'.runtime/skill-history');fs.mkdirSync(backup,{recursive:true,mode:0o700});fs.copyFileSync(target,path.join(backup,id+'-'+Date.now()+'.md'));}
 fs.writeFileSync(target,instructions,{mode:0o600});if(!fs.existsSync(path.join(dir,'source.md')))fs.writeFileSync(path.join(dir,'source.md'),instructions,{mode:0o600});
 const s={...existing,id,name,description,path:target};if(existing)Object.assign(existing,s);else catalog.skills.push(s);save();return {...s,path:undefined};
 }
 function channel(b){const name=text(b.name,80),members=[...new Set(b.members||[])];if(!members.length||members.length>20||members.some(id=>!byAgent.has(id)))throw Error('Selecione entre 1 e 20 agentes válidos.');const existing=b.id?state.channels.find(c=>c.id===b.id):null;if(b.id&&!existing)throw Error('Canal não encontrado.');const c={id:existing?.id||randomUUID(),name,description:String(b.description||'').slice(0,2000),members};if(existing)Object.assign(existing,c);else state.channels.push(c);persist();return c;
 }
 return {agent,skill,channel};
}
