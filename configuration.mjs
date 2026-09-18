import fs from 'node:fs';
import path from 'node:path';
export function ensureInstallation(root){
 for(const dir of ['.private','.runtime'])fs.mkdirSync(path.join(root,dir),{recursive:true,mode:0o700});
 const file=path.join(root,'.private/catalog.json');
 if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify({agents:[{id:'general-manager',name:'General Manager',description:'Coordinate tasks, clarify priorities, and delegate to the agents you create. Ask for approval before external or destructive actions.',skills:[],browser:false}],skills:[],routines:[]},null,2),{mode:0o600,flag:'wx'});
 return readConfiguration(root);
}
export function readConfiguration(root){
 const file=path.join(root,'.private/config.json');const input=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 const config={displayName:String(input.displayName||'').slice(0,80)};
 for(const name of ['siteOrigin','remoteOrigin']){if(!input[name])continue;const url=new URL(input[name]);if(url.protocol!=='https:'||url.username||url.password||url.origin!==input[name])throw Error(name+' must be an HTTPS origin without a path or credentials.');config[name]=url.origin;}
 return config;
}
export function writeFrontendConfiguration(root,config=readConfiguration(root)){
 fs.mkdirSync(path.join(root,'dist'),{recursive:true});
 // Only non-secret presentation/endpoint configuration. Never serialize private state or tokens.
 fs.writeFileSync(path.join(root,'dist/config.js'),'globalThis.CODEXBOT_CONFIG = '+JSON.stringify({remoteOrigin:config.remoteOrigin||'',displayName:config.displayName||''})+';\n',{mode:0o600});
}
