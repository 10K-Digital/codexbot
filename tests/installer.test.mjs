import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {installationPlan,assertIdle,assertLiveIdle,backupInstallation,launchEnvironment} from '../scripts/install-safety.mjs';
const repo=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function fixture(t){const base=fs.mkdtempSync(path.join(os.tmpdir(),'codexbot-installer-test-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));const source=path.join(base,'source'),home=path.join(base,'home');fs.mkdirSync(path.join(source,'.private'),{recursive:true});fs.mkdirSync(home);return {base,source,home};}
test('installer refuses unknown existing installations and honors recorded custom location',t=>{
 const {base,source,home}=fixture(t),root=path.join(home,'Library/Application Support/Codexbot');fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'keep'),'private');
 assert.throws(()=>installationPlan(source,home,{}),/without a matching descriptor/);
 const custom=path.join(base,'custom');fs.mkdirSync(custom);fs.writeFileSync(path.join(source,'.private/install.json'),JSON.stringify({root:custom,label:'one.test.custom'}));
 const plan=installationPlan(source,home,{});assert.equal(plan.root,custom);assert.equal(plan.label,'one.test.custom');assert.equal(fs.readFileSync(path.join(root,'keep'),'utf8'),'private');
 assert.throws(()=>installationPlan(source,home,{CODEXBOT_HOME:source}),/separate directories/);
 assert.throws(()=>installationPlan(source,home,{CODEXBOT_SERVICE_LABEL:'bad/name'}),/label/);
});
test('upgrades fail closed for active jobs, malformed state and unverified live service',async t=>{
 for(const status of ['queued','running','waiting'])assert.throws(()=>assertIdle({jobs:[{status}]}),/Active jobs/);
 assert.throws(()=>assertIdle({}),/invalid state/);assert.doesNotThrow(()=>assertIdle({jobs:[{status:'completed'}]}));
 const {base}=fixture(t);fs.mkdirSync(path.join(base,'.runtime'));fs.writeFileSync(path.join(base,'.runtime/device-token'),'test-token');
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let request;
 globalThis.fetch=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({jobs:[{status:'running'}]})};};
 await assert.rejects(assertLiveIdle(base,5432),/Active jobs/);assert.equal(request.options.headers.Authorization,'Bearer test-token');assert.equal(request.options.redirect,'error');
 globalThis.fetch=async()=>({ok:false});await assert.rejects(assertLiveIdle(base,5432),/Cannot verify/);
});
test('private backup retains profiles, conversations and descriptor with restricted permissions',t=>{
 const {base,source,home}=fixture(t),root=path.join(base,'installed');fs.mkdirSync(path.join(root,'.runtime/browser-profile'),{recursive:true});fs.writeFileSync(path.join(root,'.runtime/browser-profile','session'),'private-profile');fs.mkdirSync(path.join(root,'.private'));fs.writeFileSync(path.join(root,'.private','catalog.json'),'private-catalog');fs.writeFileSync(path.join(source,'.private/install.json'),JSON.stringify({root,label:'one.test.backup'}));
 const plan=installationPlan(source,home,{}),backup=path.join(source,'.private/backups/test');backupInstallation(plan,backup);
 assert.equal(fs.readFileSync(path.join(backup,'installation/.runtime/browser-profile/session'),'utf8'),'private-profile');assert.equal(fs.readFileSync(path.join(root,'.private/catalog.json'),'utf8'),'private-catalog');assert.equal(fs.statSync(backup).mode&0o777,0o700);assert.ok(fs.existsSync(path.join(backup,'install.json')));
});
test('LaunchAgent preserves settings without persisting API keys from the parent shell',()=>{
 const env=launchEnvironment({CUSTOM_SETTING:'kept',EQUIPE_PORT:'5001',OPENAI_API_KEY:'remove'},{PATH:'/safe/bin',EQUIPE_CODEX:'/safe/codex',CODEX_HOME:'/safe/auth',CODEX_API_KEY:'not-persisted'});
 assert.deepEqual(env,{CUSTOM_SETTING:'kept',EQUIPE_PORT:'5001',PATH:'/safe/bin',EQUIPE_CODEX:'/safe/codex',CODEX_HOME:'/safe/auth'});
});
test('prepare-only service install preserves private state on a repeat installation',t=>{
 const {base,source}=fixture(t),root=path.join(base,'installed');
 for(const file of ['install-service.mjs','configuration.mjs'])fs.copyFileSync(path.join(repo,file),path.join(source,file));
 fs.mkdirSync(path.join(source,'scripts'));fs.copyFileSync(path.join(repo,'scripts/install-safety.mjs'),path.join(source,'scripts/install-safety.mjs'));
 for(const dir of ['builtin-skills','node_modules','dist'])fs.mkdirSync(path.join(source,dir));
 for(const file of [...fs.readdirSync(repo).filter(n=>n.endsWith('.mjs')&&!['install-service.mjs','configuration.mjs'].includes(n)),'package-lock.json'])fs.writeFileSync(path.join(source,file),'');
 fs.writeFileSync(path.join(source,'package.json'),'{"type":"module"}');
 const env={...process.env,CODEXBOT_HOME:root,CODEXBOT_SERVICE_LABEL:'one.codexbot.test.'+path.basename(base)};
 let result=spawnSync(process.execPath,[path.join(source,'install-service.mjs'),'--prepare-only'],{env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const catalog=path.join(root,'.private/catalog.json');const data=JSON.parse(fs.readFileSync(catalog));assert.deepEqual(data.agents.map(a=>a.id),['general-manager']);data.agents[0].description='My private instructions';fs.writeFileSync(catalog,JSON.stringify(data));
 const state=path.join(root,'.runtime/state.json');fs.writeFileSync(state,'{"messages":["private-history"],"jobs":[]}');const token=fs.readFileSync(path.join(root,'.runtime/buzz-token'),'utf8');
 result=spawnSync(process.execPath,[path.join(source,'install-service.mjs'),'--prepare-only'],{env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(catalog)).agents[0].description,'My private instructions');assert.equal(JSON.parse(fs.readFileSync(state)).messages[0],'private-history');assert.equal(fs.readFileSync(path.join(root,'.runtime/buzz-token'),'utf8'),token);
});
test('bootstrap help is available without installation and unknown flags fail',()=>{
 const script=path.join(repo,'install.sh');assert.equal(spawnSync('/bin/bash',['-n',script]).status,0);
 const help=spawnSync('/bin/bash',[script,'--help'],{encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/--check/);
 const bad=spawnSync('/bin/bash',[script,'--unknown'],{encoding:'utf8'});assert.notEqual(bad.status,0);assert.match(bad.stderr,/Unknown option/);
});
