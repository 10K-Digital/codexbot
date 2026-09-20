import {translate,resolveLanguage} from './dist/i18n.mjs';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes, scrypt as derive, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive), COOKIE='__Host-codebox_public', TTL=12*60*60*1000;
const digest=value=>createHash('sha256').update(value).digest('hex');
const loopback=ip=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
export function publicOrigin(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.port||url.hostname==='localhost'||!url.hostname.includes('.')||/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname))throw Error('Use uma URL HTTPS pública sem caminho, porta ou credenciais.');
 return url.origin;
}
export async function hashPassword(password){
 if(typeof password!=='string'||password.length<12||Buffer.byteLength(password)>256)throw Error('Use uma senha de 12 a 256 caracteres.');
 const salt=randomBytes(16).toString('hex');
 return {salt,hash:(await scrypt(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex')};
}
export async function verifyPassword(password,record){
 if(typeof password!=='string'||Buffer.byteLength(password)>256||!record||! /^[a-f0-9]{32}$/.test(record.salt)||! /^[a-f0-9]{64}$/.test(record.hash))return false;
 const result=await scrypt(password,record.salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return timingSafeEqual(result,Buffer.from(record.hash,'hex'));
}
async function smallBody(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2048)throw Error('Request too large');}return text;}
function reply(res,status,body,type='application/json; charset=utf-8'){
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});res.end(type.startsWith('application/json')?JSON.stringify(body):body);
}
const loginPage=(error,language)=>{const tr=key=>translate(key,language);return `<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrar · Codebox</title><style>body{font:17px system-ui;background:#11151c;color:#eef2f8;max-width:400px;margin:12vh auto;padding:24px;line-height:1.6}input,button{box-sizing:border-box;width:100%;padding:14px;border-radius:10px;margin:12px 0;font:inherit}button{background:#315fdf;color:white;border:0}p{color:#b5bfce}.error{color:#ffb5b5}</style><h1>${tr('Seu Codebox')}</h1><p>${tr('Entre com a senha de acesso público definida no Mac.')}</p>${error?'<p role="alert" class="error">'+tr('Senha incorreta ou muitas tentativas. Aguarde e tente novamente.')+'</p>':''}<form method="post" action="/public/login"><label for="password">${tr('Senha')}</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus><button>${tr('Entrar')}</button></form><p>${tr('Esqueceu a senha? Defina outra nas configurações do Codebox no Mac.')}</p></html>`;};
export function findCloudflared(){
 return [process.env.CODEXBOT_CLOUDFLARED,'/opt/homebrew/bin/cloudflared','/usr/local/bin/cloudflared',...(process.env.PATH||'').split(path.delimiter).map(p=>path.join(p,'cloudflared'))].filter(Boolean).find(p=>{try{fs.accessSync(p,fs.constants.X_OK);return true;}catch{return false;}})||null;
}
// This listener is exclusively for cloudflared. It never trusts Tailscale,
// browser bearer tokens, or any identity/authorization headers from the tunnel.
export function createPublicAccess({root,bridgePort,bridgeToken,port=bridgePort+1,spawnTunnel=spawn,cloudflared=findCloudflared}){
 const file=path.join(root,'.private/config.json'),tokenFile=path.join(root,'.runtime/public-tunnel-token');
 const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 let config=read().publicAccess||{enabled:false},server=null,child=null,retry=null,status='disabled',revision=0,closed=false,serial=Promise.resolve(),verifying=0;
 const sessions=new Map(),attempts=new Map(),proxies=new Set();let windowStart=Date.now(),windowCount=0;
 const getStatus=()=>({enabled:config.enabled===true,origin:config.origin||'',passwordSet:!!config.passwordHash,tunnelConfigured:!!config.tunnelToken,connectorInstalled:!!cloudflared(),status,port:server?.address()?.port||port,authentication:'password'});
 function save(next){const all=read();all.publicAccess=next;const tmp=file+'.public.tmp';fs.writeFileSync(tmp,JSON.stringify(all,null,2),{mode:0o600});fs.renameSync(tmp,file);config=next;}
 function revoke(){revision++;sessions.clear();for(const p of proxies)p.destroy();proxies.clear();}
 function session(req){const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!raw)return null;const key=digest(raw),expiry=sessions.get(key);if(!expiry||expiry<Date.now()){sessions.delete(key);return null;}return key;}
 function canAttempt(req){
 const now=Date.now();if(now-windowStart>=60000){windowStart=now;windowCount=0;}
 for(const [key,v]of attempts)if(v.until<=now)attempts.delete(key);
 const ip=String(req.headers['cf-connecting-ip']||req.socket.remoteAddress).slice(0,64),v=attempts.get(ip)||{count:0,until:now+15*60000};
 if(verifying>=2||windowCount>=30||v.count>=5||attempts.size>=1000&&!attempts.has(ip))return false;
 v.count++;attempts.set(ip,v);windowCount++;return true;
 }
 async function handle(req,res){
 res.setHeader('Strict-Transport-Security','max-age=31536000');
 if(!config.enabled||!config.passwordHash||!config.origin)return reply(res,503,{error:'Acesso público desativado.'});
 if(!loopback(req.socket.remoteAddress)||req.headers.host!==new URL(config.origin).host||req.headers['x-forwarded-proto']!=='https')return reply(res,403,{error:'Conexão não autorizada.'});
 // Reject noncanonical paths so a denied route cannot be encoded past the gate.
 if(!req.url?.startsWith('/')||req.url.startsWith('//')||/[\\\x00-\x20]/.test(req.url))return reply(res,400,{error:'Caminho inválido.'});
 const url=new URL(req.url,config.origin);let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{return reply(res,400,{error:'Caminho inválido.'});}
 if(decoded!==url.pathname||decoded!==req.url.split('?')[0])return reply(res,400,{error:'Caminho inválido.'});
 if(!['GET','HEAD','POST'].includes(req.method))return reply(res,405,{error:'Método não permitido.'});
 if((req.headers.origin&&req.headers.origin!==config.origin)||(req.method==='POST'&&req.headers.origin!==config.origin))return reply(res,403,{error:'Origem não autorizada.'});
 if(url.pathname==='/public/login'){
  const language=resolveLanguage(null,String(req.headers['accept-language']||'pt').split(',').map(v=>v.split(';')[0].trim()));
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  if(req.method==='GET')return reply(res,200,loginPage(false,language),'text/html; charset=utf-8');
  if(req.method!=='POST')return reply(res,405,{});
  if(!canAttempt(req)){res.setHeader('Retry-After','900');return reply(res,429,loginPage(true,language),'text/html; charset=utf-8');}
  const current=revision;verifying++;
  let valid=false;try{valid=await verifyPassword(new URLSearchParams(await smallBody(req)).get('password'),config.passwordHash);}finally{verifying--;}
  if(!valid||current!==revision||!config.enabled)return reply(res,401,loginPage(true,language),'text/html; charset=utf-8');
  for(const [key,expiry]of sessions)if(expiry<Date.now())sessions.delete(key);
  if(sessions.size>=32)sessions.delete(sessions.keys().next().value);
  const token=randomBytes(32).toString('base64url');sessions.set(digest(token),Date.now()+TTL);
  res.setHeader('Set-Cookie',`${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL/1000}`);
  res.writeHead(303,{'Location':'/','Cache-Control':'no-store'});return res.end();
 }
 if(url.pathname==='/public/logout'&&req.method==='POST'){
  sessions.delete(session(req));res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);res.setHeader('Clear-Site-Data','"cache", "storage"');res.writeHead(303,{'Location':'/public/login','Cache-Control':'no-store'});return res.end();
 }
 if(!session(req)){
  if(url.pathname.startsWith('/api/'))return reply(res,401,{error:'Entre novamente com sua senha.',publicLogin:true});
  res.writeHead(303,{'Location':'/public/login','Cache-Control':'no-store'});return res.end();
 }
 if(url.pathname==='/connect'||url.pathname.startsWith('/api/public-access')||url.pathname.startsWith('/a2a')||url.pathname.startsWith('/.well-known')||url.pathname.startsWith('/public/'))return reply(res,403,{error:'Disponível somente no Mac.'});
 if(url.pathname==='/sw.js')return reply(res,200,fs.readFileSync(path.join(root,'dist/public-sw.js'),'utf8'),'text/javascript; charset=utf-8');
 if(url.pathname==='/config.js')return reply(res,200,'globalThis.CODEXBOT_CONFIG = '+JSON.stringify({publicConnection:true,remoteOrigin:config.origin})+';','text/javascript; charset=utf-8');
 const headers={host:`127.0.0.1:${bridgePort}`,authorization:'Bearer '+bridgeToken};
 for(const name of ['content-type','content-length','accept','accept-language','range','if-range'])if(req.headers[name])headers[name]=req.headers[name];
 const upstream=http.request({host:'127.0.0.1',port:bridgePort,path:req.url,method:req.method,headers},response=>{
  const safe={...response.headers,'cache-control':'no-store'};delete safe['set-cookie'];delete safe['access-control-allow-origin'];delete safe['access-control-allow-private-network'];
  res.writeHead(response.statusCode,safe);response.pipe(res);
 });
 proxies.add(upstream);upstream.on('close',()=>proxies.delete(upstream));upstream.on('error',()=>{if(!res.headersSent)reply(res,502,{error:'O Mac não respondeu.'});else res.destroy();});
 upstream.setTimeout(200000,()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
 }
 async function stop(){
 revoke();clearTimeout(retry);retry=null;
 if(child){const old=child;child=null;old.kill('SIGTERM');const timer=setTimeout(()=>old.kill('SIGKILL'),3000);timer.unref();old.once('exit',()=>clearTimeout(timer));}
 if(server){const old=server;server=null;old.closeAllConnections();await new Promise(resolve=>old.close(resolve));}
 status='disabled';
 }
 function launch(){
 if(closed||!config.enabled||child)return;
 const binary=cloudflared();if(!binary){status='connector-missing';return;}
 fs.writeFileSync(tokenFile,config.tunnelToken,{mode:0o600});fs.chmodSync(tokenFile,0o600);
 status='connecting';const proc=spawnTunnel(binary,['tunnel','--no-autoupdate','run','--token-file',tokenFile],{stdio:['ignore','ignore','pipe'],env:{PATH:process.env.PATH,HOME:process.env.HOME}});child=proc;
 // Inspect only the readiness marker; raw connector output may contain private data.
 proc.stderr?.on('data',chunk=>{if(child===proc&&String(chunk).includes('Registered tunnel connection'))status='connected';});
 const ended=()=>{if(child!==proc)return;child=null;status='reconnecting';retry=setTimeout(launch,15000);retry.unref();};proc.once('error',ended);proc.once('exit',ended);
 }
 async function start(){
 if(!config.enabled||closed)return;
 publicOrigin(config.origin);if(!config.passwordHash||!config.tunnelToken)throw Error('Configure uma senha e o túnel antes de ativar.');
 server=http.createServer((req,res)=>{void handle(req,res).catch(()=>{if(!res.headersSent)reply(res,400,{error:'Requisição inválida.'});else res.destroy();});});
 server.requestTimeout=30000;server.headersTimeout=15000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});launch();
 }
 function configure(input){const work=serial.then(async()=>{
  if(typeof input!=='object'||input===null)throw Error('Configuração inválida.');
  if(input.action==='install'){
   if(cloudflared())return getStatus();
   const brew=['/opt/homebrew/bin/brew','/usr/local/bin/brew'].find(p=>fs.existsSync(p));
   if(!brew)throw Error('Instale o Homebrew ou execute o instalador com --with-public-access.');
   await new Promise((resolve,reject)=>{const proc=spawn(brew,['install','cloudflared'],{stdio:'ignore',env:{...process.env,HOMEBREW_NO_AUTO_UPDATE:'1'},timeout:180000});proc.once('error',reject);proc.once('exit',code=>code===0?resolve():reject(Error('Não foi possível instalar o conector. Execute brew install cloudflared no Terminal.')));});
   if(config.enabled)launch();return getStatus();
  }
  const next={...config};if(input.enabled!==undefined){if(typeof input.enabled!=='boolean')throw Error('Configuração inválida.');next.enabled=input.enabled;}
  if(input.origin!==undefined)next.origin=publicOrigin(input.origin);
  if(input.password)next.passwordHash=await hashPassword(input.password);
  if(input.tunnelToken){if(typeof input.tunnelToken!=='string'||! /^[A-Za-z0-9_+/=-]{40,4096}$/.test(input.tunnelToken))throw Error('Token do túnel inválido. Cole apenas o token, não o comando.');next.tunnelToken=input.tunnelToken;}
  if(next.enabled&&(!next.passwordHash||!next.origin||!next.tunnelToken))throw Error('Defina a URL, a senha e o token do túnel antes de ativar.');
  if(next.enabled&&!cloudflared())throw Error('Instale o conector Cloudflare no Mac antes de ativar.');
  await stop();save(next);try{await start();}catch{status='error';}
  return getStatus();
 });serial=work.catch(()=>{});return work;}
 return {status:getStatus,configure,revoke,async start(){try{await start();}catch{status='error';}},async close(){closed=true;await serial;await stop();},handler:handle};
}
