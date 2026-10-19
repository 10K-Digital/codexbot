import {isImportedWrapper,inlineImportedInstructions} from './imported-skills.mjs';
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
const nativeIds=new Set(['codexbot-feedback-review']);
export const isNativeSkill=s=>!!s&&(nativeIds.has(s.id)||s.native===true);
export const publicSkill=s=>({id:s.id,name:s.name,description:s.description,native:isNativeSkill(s),canRead:!isNativeSkill(s),canEdit:!isNativeSkill(s)});
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
 let id=existing?.id||slug(name)||'agente-'+randomUUID().slice(0,8);if(!existing&&catalog.deletedAgents?.some(a=>a.id===id))id+='-'+randomUUID();if(!existing&&byAgent.has(id))throw Error('Já existe um agente com esse nome.');
 const skills=Array.isArray(b.skills)?[...new Set(b.skills)]:[];if(skills.some(id=>!catalog.skills.some(s=>s.id===id)))throw Error('Skill desconhecida.');
 resetAgent(id);const a={...existing,id,name,description,skills,browser:b.browser===true};if(existing)Object.assign(existing,a);else catalog.agents.push(a);byAgent.set(id,existing||a);save();return a;
 }
 // Catalogue tombstones make reference cleanup repeatable after an interrupted save.
 function reconcileDeletedAgents(){
  const ids=new Set((catalog.deletedAgents||[]).map(a=>a.id));if(!ids.size)return;
  state.routines=(state.routines||[]).filter(r=>!ids.has(r.agentId));
  state.messageThreads=(state.messageThreads||[]).filter(t=>!ids.has(t.agentId)&&!ids.has(t.baseConversationId));
  for(const c of state.channels||[])c.members=c.members.filter(id=>!ids.has(id));
  for(const r of catalog.deletedAgents)for(const id of r.routineIds||[])if(state.scheduleSlots)delete state.scheduleSlots[id];
  persist();
 }
 function deleteAgent({id,confirmed}){
  const a=byAgent.get(id);if(!a)throw Error('Agente não encontrado.');
  if(confirmed!==true)throw Error('Confirme a exclusão do agente antes de continuar.');
  if((state.jobs||[]).some(j=>j.agentId===id&&['queued','running','waiting'].includes(j.status)))throw Error('Conclua ou cancele as tarefas pendentes deste agente antes de excluí-lo.');
  resetAgent(id);
  const routines=(state.routines||[]).filter(r=>r.agentId===id),deletedAt=new Date().toISOString();
  const archive=path.join(root,'.runtime/deleted-agents');fs.mkdirSync(archive,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(archive,randomUUID()+'.json'),JSON.stringify({agent:a,deletedAt,routines,channels:(state.channels||[]).filter(c=>c.members.includes(id)),messageThreads:(state.messageThreads||[]).filter(t=>t.agentId===id||t.baseConversationId===id)},null,2),{mode:0o600});
  const previous={agents:catalog.agents,routines:catalog.routines,deletedAgents:catalog.deletedAgents};
  catalog.agents=catalog.agents.filter(a=>a.id!==id);catalog.routines=(catalog.routines||[]).filter(r=>r.agentId!==id);
  catalog.deletedAgents=[...(catalog.deletedAgents||[]),{id,name:a.name,deletedAt,routineIds:routines.map(r=>r.id)}];
  try{save();}catch(e){Object.assign(catalog,previous);throw e;}
  byAgent.delete(id);reconcileDeletedAgents();return {ok:true};
 }
 reconcileDeletedAgents();
 function skill(b,internal=false){const name=text(b.name,120),description=text(b.description,1200),instructions=text(b.instructions,100000);const existing=b.id?catalog.skills.find(s=>s.id===b.id):null;if(b.id&&!existing)throw Error('Skill não encontrada.');
 const id=existing?.id||slug(name)||'skill-'+randomUUID().slice(0,8);if(!existing&&catalog.skills.some(s=>s.id===id))throw Error('Já existe uma skill com esse nome.');
 if(!internal&&(isNativeSkill(existing)||nativeIds.has(id)||b.native===true))throw Error('As instruções de skills nativas são gerenciadas pelo sistema.');
 const dir=path.join(root,'.private/skills',id);fs.mkdirSync(dir,{recursive:true,mode:0o700});const target=path.join(dir,'SKILL.md');
 if(fs.existsSync(target)){const backup=path.join(root,'.runtime/skill-history');fs.mkdirSync(backup,{recursive:true,mode:0o700});fs.copyFileSync(target,path.join(backup,id+'-'+Date.now()+'.md'));}
 fs.writeFileSync(target,instructions,{mode:0o600});if(!fs.existsSync(path.join(dir,'source.md')))fs.writeFileSync(path.join(dir,'source.md'),instructions,{mode:0o600});
 const s={...existing,id,name,description,path:target,...(internal?{native:true}:{})};if(existing)Object.assign(existing,s);else catalog.skills.push(s);save();return publicSkill(s);
 }
 function deleteSkill({id}){
  const skill=catalog.skills.find(s=>s.id===id);if(!skill)throw Error('Skill não encontrada.');
  if(isNativeSkill(skill))throw Error('Skills nativas são gerenciadas pelo sistema e não podem ser excluídas.');
  const affected=catalog.agents.filter(a=>a.skills?.includes(id));
  const archive=path.join(root,'.runtime/deleted-skills');fs.mkdirSync(archive,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(archive,randomUUID()+'.json'),JSON.stringify({skill,agentIds:affected.map(a=>a.id),instructions:fs.existsSync(skill.path)?fs.readFileSync(skill.path,'utf8'):null,deletedAt:new Date().toISOString()},null,2),{mode:0o600});
  catalog.skills=catalog.skills.filter(s=>s.id!==id);for(const a of affected)a.skills=a.skills.filter(s=>s!==id);save();
  return {ok:true};
 }
 function channel(b){const name=text(b.name,80),members=[...new Set(b.members||[])];if(!members.length||members.length>20||members.some(id=>!byAgent.has(id)))throw Error('Selecione entre 1 e 20 agentes válidos.');const existing=b.id?state.channels.find(c=>c.id===b.id):null;if(b.id&&!existing)throw Error('Canal não encontrado.');const c={id:existing?.id||randomUUID(),name,description:String(b.description||'').slice(0,2000),members};if(existing)Object.assign(existing,c);else state.channels.push(c);persist();return c;
 }
 function migrateImportedSkills(){let count=0;for(const s of [...catalog.skills]){if(isNativeSkill(s))continue;const instructions=fs.readFileSync(s.path,'utf8');if(!isImportedWrapper(instructions))continue;const source=fs.readFileSync(path.join(path.dirname(s.path),'source.md'),'utf8');skill({...s,instructions:inlineImportedInstructions(instructions,source)});count++;}return count;}
 function readSkill(id){const s=catalog.skills.find(s=>s.id===id);if(!s)throw Error('Skill não encontrada.');if(isNativeSkill(s))throw Error('As instruções de skills nativas são gerenciadas pelo sistema.');const instructions=fs.readFileSync(s.path,'utf8');return {...publicSkill(s),instructions:isImportedWrapper(instructions)?inlineImportedInstructions(instructions,fs.readFileSync(path.join(path.dirname(s.path),'source.md'),'utf8')):instructions};}
 function installNativeSkill(b){const id=b.id||slug(b.name);if(!nativeIds.has(id))throw Error('Skill nativa desconhecida.');return skill(b,true);}
 return {agent,deleteAgent,skill,deleteSkill,channel,readSkill,installNativeSkill,migrateImportedSkills};
}
