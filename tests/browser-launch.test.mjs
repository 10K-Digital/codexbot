import test from 'node:test';import assert from 'node:assert/strict';import net from 'node:net';
import {browserDebugPort,browserLaunchArgs} from '../browser-launch.mjs';
test('Chrome receives a real available loopback debugging port and the same isolated profile',async()=>{
 const port=await browserDebugPort();assert(port>=1024&&port<=65535);
 const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});await new Promise(resolve=>server.close(resolve));
 const args=browserLaunchArgs('/private/browser-profile',port);
 assert(args.includes('--remote-debugging-port='+port));assert(args.includes('--remote-debugging-address=127.0.0.1'));assert(args.includes('--user-data-dir=/private/browser-profile'));
 for(const flag of ['--remote-debugging-port=0','--enable-automation','--headless','--disable-web-security','--ignore-certificate-errors'])assert(!args.includes(flag));
 for(const port of [0,-1,65536,'9222'])assert.throws(()=>browserLaunchArgs('/private/browser-profile',port));
});
