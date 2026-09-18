import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {installationPlan,assertIdle,fileState,assertLiveIdle,assertPortFree,backupInstallation} from './install-safety.mjs';
const source=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const run=(command,args,options={})=>{const r=spawnSync(command,args,{cwd:source,stdio:'inherit',...options});if(r.error||r.status!==0)throw Error(`Command failed: ${path.basename(command)} ${args[0]||''}`);return r;};
if(process.platform!=='darwin'||process.getuid()===0)throw Error('Install as a normal macOS user.');
for(const arg of process.argv.slice(2))if(!['--bootstrap','--no-open','--with-local-voice'].includes(arg))throw Error('Unknown option: '+arg);
const plan=installationPlan(source,os.homedir());
const service=`gui/${process.getuid()}/${plan.label}`;
const launch=(args)=>spawnSync('/bin/launchctl',args,{encoding:'utf8'});
let oldPlist=null;
if(fs.existsSync(plan.plist)){
 const parsed=spawnSync('/usr/bin/plutil',['-convert','json','-o','-',plan.plist],{encoding:'utf8'});
 if(parsed.status!==0)throw Error('Could not inspect existing LaunchAgent.');
 oldPlist=JSON.parse(parsed.stdout);
 if(oldPlist.WorkingDirectory!==plan.root||!oldPlist.ProgramArguments?.includes(path.join(plan.root,'server.mjs')))throw Error('Service label belongs to another installation; nothing changed.');
}
const serviceEnv=oldPlist?.EnvironmentVariables||{};
const env={...process.env,...serviceEnv};
// Preserve the running installation environment unless explicitly overridden for this run.
for(const key of ['PATH','EQUIPE_CODEX','CODEX_HOME','CODEXBOT_PORT','EQUIPE_PORT'])if(process.env[key])env[key]=process.env[key];
const oldPort=Number(serviceEnv.CODEXBOT_PORT||serviceEnv.EQUIPE_PORT||4320);
const port=Number(env.CODEXBOT_PORT||env.EQUIPE_PORT||4320);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid bridge port.');
const running=launch(['print',service]).status===0;
if(running&&!oldPlist)throw Error('Loaded service has no recognized plist. Review it manually.');
if(plan.existing)assertIdle(fileState(plan.root));
if(running)await assertLiveIdle(plan.root,oldPort);
else await assertPortFree(port);
if(running&&port!==oldPort)await assertPortFree(port);
const lock=path.join(source,'.private/installer.lock');
try{fs.mkdirSync(lock,{mode:0o700});}catch{throw Error('Another installer may be running. Review .private/installer.lock before retrying.');}
const backup=path.join(source,'.private/backups',new Date().toISOString().replace(/[:.]/g,'-'));
let stopped=false,backedUp=false,installStarted=false;
try{
 if(running){
  if(launch(['bootout',service]).status!==0)throw Error('Could not stop the existing service safely.');
  stopped=true;
  for(let i=0;i<50&&launch(['print',service]).status===0;i++)await wait(100);
  if(launch(['print',service]).status===0)throw Error('Existing service has not stopped.');
  // A job admitted between the live check and shutdown must not be silently overwritten.
  assertIdle(fileState(plan.root));
  await assertPortFree(port);
 }
 backupInstallation(plan,backup);backedUp=true;
 console.log('Private backup: '+backup);
 installStarted=true;
 run(process.execPath,['install-service.mjs'],{env:{...env,CODEXBOT_HOME:plan.root,CODEXBOT_SERVICE_LABEL:plan.label}});
 if(process.argv.includes('--with-local-voice'))run('npm',['run','setup:voice'],{cwd:plan.root,env});
 let ready=false;
 for(let i=0;i<45;i++){
  try{const r=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(2000)});const h=await r.json();if(r.ok&&h.service==='equipe'&&h.ready===true){ready=true;break;}}catch{}
  await wait(1000);
 }
 if(!ready)throw Error('Bridge did not become ready with ChatGPT. Review the private service logs and sign-in, then retry.');
 fs.writeFileSync(path.join(plan.root,'.private/source.json'),JSON.stringify({source,commit:spawnSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).stdout.trim()},null,2),{mode:0o600});
 console.log(`Codexbot ready. Installation: ${plan.root}\nService: ${plan.label}\nOpen locally: http://127.0.0.1:${port}/connect`);
 if(!process.argv.includes('--no-open')){const opened=spawnSync('/usr/bin/open',[`http://127.0.0.1:${port}/connect`]);if(opened.status!==0)console.warn('Open the local connection page manually.');}
}catch(error){
 // Once activation was attempted, do not restore/replay old state automatically:
 // a scheduled job might already have produced external side effects.
 if(!installStarted&&stopped&&fs.existsSync(plan.plist)){
  const restored=launch(['bootstrap',`gui/${process.getuid()}`,plan.plist]);
  if(restored.status!==0)console.error('Previous files were preserved, but the service needs manual restart.');
 }
 if(installStarted)console.error('Current files and state were kept. Inspect the service before recovery; no history was reset or automatically replayed.');
 console.error('Installation stopped: '+error.message);
 if(backedUp)console.error('Backup and recovery files: '+backup);
 process.exitCode=1;
}finally{fs.rmdirSync(lock);}
