import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomBytes,randomUUID,createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),descriptor=path.join(here,'.private/install.json');
const installed=fs.existsSync(descriptor)?JSON.parse(fs.readFileSync(descriptor,'utf8')).root:null;
const args=process.argv.slice(2),root=process.env.EQUIPE_HOME||installed||(fs.existsSync(path.join(here,'.private/catalog.json'))?here:path.join(os.homedir(),'Library/Application Support/Codexbot')),file=path.join(root,'.runtime/a2a-clients.json');
const store=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{clients:[]};
const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(store,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);};
if(args[0]==='list')console.log(JSON.stringify(store.clients.map(({hash,...c})=>c),null,2));
else if(args[0]==='revoke'){const c=store.clients.find(c=>c.id===args[1]);if(!c)throw Error('Cliente não encontrado.');c.revoked=true;save();console.log('Credencial revogada.');}
else if(args[0]==='create'){
 const name=args[1],outputIndex=args.indexOf('--output'),scopeIndex=args.indexOf('--agents');
 if(!name||outputIndex<0||scopeIndex<0)throw Error('Uso: node a2a-clients.mjs create NOME --agents id1,id2 --output /caminho/privado/token');
 const all=JSON.parse(fs.readFileSync(path.join(root,'.private/catalog.json'),'utf8')).agents.map(a=>a.id);const ids=args[scopeIndex+1]==='all'?all:args[scopeIndex+1].split(',');if(ids.some(id=>!all.includes(id)))throw Error('Agente desconhecido.');
 const token=randomBytes(32).toString('base64url'),out=path.resolve(args[outputIndex+1]);fs.writeFileSync(out,token+'\n',{mode:0o600,flag:'wx'});
 const c={id:randomUUID(),name,agentIds:ids,hash:createHash('sha256').update(token).digest('hex'),createdAt:new Date().toISOString(),revoked:false};store.clients.push(c);save();console.log(JSON.stringify({id:c.id,name,agentIds:ids,credentialFile:out}));
}else console.log('Comandos: list | create NOME --agents id1,id2 --output ARQUIVO | revoke ID');
