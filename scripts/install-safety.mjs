import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
export const activeStatuses=new Set(['queued','running','waiting']);
export function installationPlan(source,home,env=process.env){
 const descriptor=path.join(source,'.private/install.json');
 const saved=fs.existsSync(descriptor)?JSON.parse(fs.readFileSync(descriptor,'utf8')):{};
 if(saved.root!==undefined&&(!path.isAbsolute(saved.root)||typeof saved.label!=='string'))throw Error('Invalid .private/install.json. Review it before installing.');
 const root=path.resolve(env.CODEXBOT_HOME||saved.root||path.join(home,'Library/Application Support/Codexbot'));
 const label=env.CODEXBOT_SERVICE_LABEL||saved.label||'one.codexbot.service';
 if(!/^[A-Za-z0-9.-]+$/.test(label))throw Error('Invalid service label.');
 const overlap=(a,b)=>a===b||a.startsWith(b+path.sep);
 const actualSource=fs.realpathSync(source),actualRoot=fs.existsSync(root)?fs.realpathSync(root):root;
 if(overlap(actualSource,actualRoot)||overlap(actualRoot,actualSource))throw Error('Source and installation must be separate directories.');
 if(fs.existsSync(root)&&fs.lstatSync(root).isSymbolicLink())throw Error('Installation directory must not be a symlink.');
 if(fs.existsSync(root)&&fs.readdirSync(root).length&&!saved.root&&!env.CODEXBOT_HOME)throw Error('An installation exists without a matching descriptor. Use --source for its original checkout or explicitly set CODEXBOT_HOME; no existing installation was changed.');
 return {source,root,label,descriptor,plist:path.join(home,'Library/LaunchAgents',label+'.plist'),existing:fs.existsSync(root)&&fs.readdirSync(root).length>0};
}
export function assertIdle(state){
 if(!state||!Array.isArray(state.jobs))throw Error('Cannot verify active jobs: invalid state.');
 if(state.jobs.some(j=>activeStatuses.has(j.status)))throw Error('Active jobs found. Finish or stop them in Codexbot before updating. Nothing was reset.');
}
export function fileState(root){const file=path.join(root,'.runtime/state.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{jobs:[]};}
export async function assertLiveIdle(root,port){
 const tokenPath=path.join(root,'.runtime/device-token');
 if(!fs.existsSync(tokenPath))throw Error('Cannot authenticate to the existing service. Review the installation path.');
 const token=fs.readFileSync(tokenPath,'utf8').trim();
 const response=await fetch(`http://127.0.0.1:${port}/api/state`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000),redirect:'error'});
 if(!response.ok)throw Error('Cannot verify active jobs on the existing service; update stopped.');
 assertIdle(await response.json());
}
export async function assertPortFree(port){
 await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(Error(`Port ${port} is occupied. Do not overwrite another installation; review its descriptor.`)));server.listen(port,'127.0.0.1',()=>server.close(resolve));});
}
export function backupInstallation(plan,backup){
 fs.mkdirSync(backup,{recursive:true,mode:0o700});fs.chmodSync(backup,0o700);
 if(plan.existing)fs.cpSync(plan.root,path.join(backup,'installation'),{recursive:true,preserveTimestamps:true,verbatimSymlinks:true});
 if(fs.existsSync(plan.plist))fs.copyFileSync(plan.plist,path.join(backup,'service.plist'));
 if(fs.existsSync(plan.descriptor))fs.copyFileSync(plan.descriptor,path.join(backup,'install.json'));
 fs.writeFileSync(path.join(backup,'plan.json'),JSON.stringify({root:plan.root,label:plan.label},null,2),{mode:0o600});
}

export function launchEnvironment(prior={},env=process.env){
 const result={...prior,PATH:env.PATH||prior.PATH||'/usr/bin:/bin'};
 for(const name of ['EQUIPE_CODEX','CODEX_HOME','CODEXBOT_PORT','EQUIPE_PORT'])if(env[name])result[name]=String(env[name]);
 delete result.OPENAI_API_KEY;delete result.CODEX_API_KEY;
 return result;
}
