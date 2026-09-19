import net from 'node:net';

// Ask the OS for a free loopback port, then pass the actual number to Chrome.
// Chrome treats --remote-debugging-port=0 as a WebDriver automation signal.
export async function browserDebugPort(){
 const server=net.createServer();
 return new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(error=>error?reject(error):resolve(port));});
 });
}
export function browserLaunchArgs(directory,port){
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Porta do navegador inválida.');
 return ['--start-minimized','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`,'--user-data-dir='+directory,'--no-first-run','--no-default-browser-check','--window-size=1280,800','about:blank'];
}
