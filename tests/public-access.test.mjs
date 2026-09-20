import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import {EventEmitter} from 'node:events';
import {createPublicAccess,hashPassword,verifyPassword,publicOrigin} from '../public-access.mjs';
import {ensureInstallation,writeFrontendConfiguration} from '../configuration.mjs';
const password='a long synthetic password',origin='https://test.example.com';
const hash=await hashPassword(password);
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'codebox-public-test-'));ensureInstallation(root);
 fs.writeFileSync(path.join(root,'.private/config.json'),JSON.stringify({displayName:'preserved',other:{setting:true},publicAccess:{enabled:true,origin,passwordHash:hash,tunnelToken:'a'.repeat(80)}}));
 const received=[];const bridge=http.createServer((req,res)=>{received.push({url:req.url,headers:req.headers});let body='';req.on('data',c=>body+=c);req.on('end',()=>{res.setHeader('Set-Cookie','equipe_files=private-device-token');res.end(JSON.stringify({ok:true,body}));});});
 await new Promise(r=>bridge.listen(0,'127.0.0.1',r));
 let process;const manager=createPublicAccess({root,bridgePort:bridge.address().port,bridgeToken:'private-device-token',port:0,cloudflared:()=>'/fixture/cloudflared',spawnTunnel:(binary,args)=>{assert(!args.includes('a'.repeat(80)));assert(args.includes('--token-file'));process=new EventEmitter();process.stderr=new EventEmitter();process.kill=()=>{process.emit('exit',0);};return process;}});
 await manager.start();assert.equal(manager.status().status,'connecting');process.stderr.emit('data','Registered tunnel connection');assert.equal(manager.status().status,'connected');
 t.after(async()=>{await manager.close();bridge.closeAllConnections();await new Promise(r=>bridge.close(r));fs.rmSync(root,{recursive:true,force:true});});
 const request=(url='/',{headers={},method='GET',body}={})=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:manager.status().port,path:url,method,headers:{host:'test.example.com','x-forwarded-proto':'https',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);});
 const login=()=>request('/public/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password}).toString()});
 return {root,manager,request,login,received};
}
test('password hashing is salted, bounded and fails closed',async()=>{
 assert(await verifyPassword(password,hash));assert(!await verifyPassword('wrong',hash));assert(!await verifyPassword(password,{}));assert.notDeepEqual(await hashPassword(password),hash);
 await assert.rejects(hashPassword('short'));await assert.rejects(hashPassword('a'.repeat(257)));
 for(const value of ['http://test.example.com','https://test.example.com/','https://x:y@test.example.com','https://localhost','https://127.0.0.1','https://test.example.com:443'])assert.throws(()=>publicOrigin(value));
});
test('all public content is gated and neither local bearer nor Tailscale headers bypass login',async t=>{
 const {request,received}=await fixture(t);
 for(const route of ['/','/app.js','/config.js','/connect','/sw.js']){const r=await request(route,{headers:{authorization:'Bearer private-device-token','tailscale-user-login':'owner@test.example'}});assert.equal(r.status,303,route);assert.equal(r.headers.location,'/public/login');}
 for(const route of ['/api/state','/api/files/example','/api/public-access'])assert.equal((await request(route)).status,401);
 assert.equal((await request('/',{headers:{host:'localhost'}})).status,403);
 assert.equal((await request('/',{headers:{'x-forwarded-proto':'http'}})).status,403);
 assert.equal(received.length,0);
});
test('login grants a secure cookie, strips credentials, supports uploads, and blocks local control routes',async t=>{
 const {request,login,received,manager}=await fixture(t);const r=await login();assert.equal(r.status,303);
 const set=r.headers['set-cookie'][0];for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert(set.includes(flag));
 const cookie=set.split(';')[0];
 const state=await request('/api/state',{headers:{cookie,'tailscale-user-login':'forged',authorization:'Bearer forged','x-forwarded-for':'forged'}});
 assert.equal(state.status,200);assert.equal(state.headers['set-cookie'],undefined);assert.equal(received[0].headers.authorization,'Bearer private-device-token');assert.equal(received[0].headers.cookie,undefined);assert.equal(received[0].headers['tailscale-user-login'],undefined);assert.equal(received[0].headers['x-forwarded-for'],undefined);
 const upload=await request('/api/uploads?name=test.txt',{method:'POST',headers:{cookie,origin,'content-type':'text/plain'},body:'file content'});assert.equal(JSON.parse(upload.text).body,'file content');
 for(const route of ['/connect','/api/public-access','/a2a','/.well-known/agent-card.json'])assert.equal((await request(route,{headers:{cookie}})).status,403);
 for(const route of ['/%63onnect','/x/../connect','/api/%70ublic-access','//connect'])assert.equal((await request(route,{headers:{cookie}})).status,400);
 assert.equal((await request('/api/send',{method:'POST',headers:{cookie},body:'{}'})).status,403);
 assert.equal((await request('/api/send',{method:'POST',headers:{cookie,origin:'https://evil.example'},body:'{}'})).status,403);
 const config=await request('/config.js',{headers:{cookie}});assert(config.text.includes('publicConnection'));assert(!config.text.includes('private-device-token'));assert(!JSON.stringify(manager.status()).includes(hash.hash));
 const out=await request('/public/logout',{method:'POST',headers:{cookie,origin}});assert.equal(out.status,303);assert(out.headers['clear-site-data']);assert.equal((await request('/api/state',{headers:{cookie}})).status,401);
});
test('configuration preserves other private settings and revokes existing sessions',async t=>{
 const {request,login,manager,root}=await fixture(t);const cookie=(await login()).headers['set-cookie'][0].split(';')[0];
 await manager.configure({password:'replacement synthetic password'});
 assert.equal((await request('/api/state',{headers:{cookie}})).status,401);
 const saved=JSON.parse(fs.readFileSync(path.join(root,'.private/config.json')));assert.equal(saved.displayName,'preserved');assert.equal(saved.other.setting,true);assert(!JSON.stringify(saved).includes('replacement synthetic password'));assert.equal(fs.statSync(path.join(root,'.private/config.json')).mode&0o777,0o600);
 writeFrontendConfiguration(root);assert(!fs.readFileSync(path.join(root,'dist/config.js'),'utf8').includes('publicAccess'));
 await manager.configure({enabled:false});assert.equal(manager.status().enabled,false);assert.equal(manager.status().origin,origin);assert(manager.status().passwordSet);
});
test('login attempts are rate limited before expensive password verification',async t=>{
 const {request}=await fixture(t);
 for(let i=0;i<5;i++)assert.equal((await request('/public/login',{method:'POST',headers:{origin},body:'password=wrong'})).status,401);
 const limited=await request('/public/login',{method:'POST',headers:{origin},body:'password=wrong'});assert.equal(limited.status,429);assert.equal(limited.headers['retry-after'],'900');
});

test('expired sessions and global brute-force attempts fail closed',async t=>{
 const {request,login}=await fixture(t);const cookie=(await login()).headers['set-cookie'][0].split(';')[0];
 const realNow=Date.now;const future=realNow()+13*60*60*1000;t.mock.method(Date,'now',()=>future);
 assert.equal((await request('/api/state',{headers:{cookie}})).status,401);
 t.mock.restoreAll();
 for(let i=0;i<29;i++)assert.equal((await request('/public/login',{method:'POST',headers:{origin,'cf-connecting-ip':'198.51.100.'+i},body:'password=wrong'})).status,401);
 assert.equal((await request('/public/login',{method:'POST',headers:{origin,'cf-connecting-ip':'198.51.100.99'},body:'password=wrong'})).status,429);
});

test('password sessions cannot be replayed across public and Tailscale origins',async t=>{
 const {manager,login}=await fixture(t);await manager.configure({requireTailscalePassword:true});
 const cookie=(await login()).headers['set-cookie'][0].split(';')[0];
 const tls=http.createServer(async(req,res)=>{if(!await manager.tailscaleGate(req,res,'https://private.tailnet.ts.net'))res.end('authorized');});
 await new Promise(r=>tls.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>tls.close(r)));
 const status=await new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:tls.address().port,path:'/api/state',headers:{host:'private.tailnet.ts.net',cookie}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(status,401);
});
