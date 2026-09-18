import {ensureInstallation,writeFrontendConfiguration} from './configuration.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const source=path.dirname(fileURLToPath(import.meta.url));
const descriptor=path.join(source,'.private/install.json');
const existing=fs.existsSync(descriptor)?JSON.parse(fs.readFileSync(descriptor,'utf8')):{};
const root=path.resolve(process.env.CODEXBOT_HOME||existing.root||path.join(os.homedir(),'Library/Application Support/Codexbot'));
const label=process.env.CODEXBOT_SERVICE_LABEL||existing.label||'one.codexbot.service';
if(!/^[A-Za-z0-9.-]+$/.test(label))throw Error('Invalid service label');
fs.mkdirSync(root,{recursive:true,mode:0o700});
for(const name of ['routing.mjs','context.mjs','feedback.mjs','builtin-skills','live-voice.mjs','voice.mjs','scripts','configuration.mjs','server.mjs','smart-cards.mjs','lib.mjs','attachments.mjs','management.mjs','a2a.mjs','a2a-clients.mjs','buzz-acp.mjs','push.mjs','virtual-browser.mjs','package.json','package-lock.json','node_modules','dist'])fs.cpSync(path.join(source,name),path.join(root,name),{recursive:true});
ensureInstallation(root);writeFrontendConfiguration(root);
fs.mkdirSync(path.dirname(descriptor),{recursive:true,mode:0o700});fs.writeFileSync(descriptor,JSON.stringify({root,label},null,2),{mode:0o600});
const catalogPath=path.join(root,'.private/catalog.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
for(const skill of catalog.skills)skill.path=path.join(root,'.private/skills',skill.id,'SKILL.md');
fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2),{mode:0o600});
const tokenFile=path.join(root,'.runtime/buzz-token');if(!fs.existsSync(tokenFile)){const token=randomBytes(32).toString('base64url');const clientsFile=path.join(root,'.runtime/a2a-clients.json');const data=fs.existsSync(clientsFile)?JSON.parse(fs.readFileSync(clientsFile,'utf8')):{clients:[]};data.clients.push({id:randomUUID(),name:'Buzz local',hash:createHash('sha256').update(token).digest('hex'),agentIds:catalog.agents.map(a=>a.id),createdAt:new Date().toISOString()});fs.writeFileSync(clientsFile,JSON.stringify(data,null,2),{mode:0o600});fs.writeFileSync(tokenFile,token,{mode:0o600});}
const harnessDir=path.join(root,'.runtime/buzz-harnesses');fs.mkdirSync(harnessDir,{recursive:true});for(const a of catalog.agents)fs.writeFileSync(path.join(harnessDir,'equipe-'+a.id+'.json'),JSON.stringify({id:'equipe-'+a.id,label:'Equipe · '+a.name,command:process.execPath,args:[path.join(root,'buzz-acp.mjs'),a.id]},null,2));
if(process.argv.includes('--prepare-only')){console.log('Installation prepared without starting the service.');process.exit(0);}
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const target=path.join(os.homedir(),'Library/LaunchAgents',label+'.plist');
const content=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${xml(label)}</string><key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(root,'server.mjs'))}</string></array><key>WorkingDirectory</key><string>${xml(root)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer><key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH||'/usr/bin:/bin')}</string></dict><key>StandardOutPath</key><string>${xml(path.join(root,'.runtime/service.log'))}</string><key>StandardErrorPath</key><string>${xml(path.join(root,'.runtime/service-error.log'))}</string></dict></plist>`;
fs.mkdirSync(path.dirname(target),{recursive:true});
if(fs.existsSync(target)){
 const prior=fs.readFileSync(target,'utf8');
 if(!prior.includes(xml(source))&&!prior.includes(xml(root)))throw Error('Um serviço com esse nome já existe com outra configuração.');
 spawnSync('launchctl',['bootout',`gui/${process.getuid()}/${label}`],{encoding:'utf8'});
}
fs.writeFileSync(target,content,{mode:0o600});
let r;for(let attempt=0;attempt<8;attempt++){r=spawnSync('launchctl',['bootstrap',`gui/${process.getuid()}`,target],{encoding:'utf8'});if(r.status===0)break;await new Promise(resolve=>setTimeout(resolve,500));}
if(r.status!==0)throw Error(r.stderr||'Falha ao instalar serviço');
console.log('Executor instalado para iniciar no login deste usuário.');
