import {spawn} from 'node:child_process';
export const CLIPBOARD_LIMIT=100000;
export const clipboardActions=new Set(['clipboardRead','clipboardWrite','clipboardCopy','clipboardPaste','selectAll']);
export function validateClipboardText(text){if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>CLIPBOARD_LIMIT||text.includes('\0'))throw Error('O clipboard aceita até 100 KB de texto.');return text;}
export function macClipboard(spawnProcess=spawn){
 function run(binary,input){return new Promise((resolve,reject)=>{const child=spawnProcess(binary,binary.endsWith('pbpaste')?['-Prefer','txt']:[],{stdio:['pipe','pipe','ignore'],env:{...process.env,LANG:'en_US.UTF-8'}});const chunks=[];let size=0,done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};const timer=setTimeout(()=>{child.kill();finish(Error('O clipboard do Mac não respondeu.'));},5000);child.on('error',()=>finish(Error('Não foi possível acessar o clipboard do Mac.')));child.stdin.on('error',()=>finish(Error('Não foi possível escrever no clipboard do Mac.')));child.stdout.on('data',chunk=>{size+=chunk.length;if(size>CLIPBOARD_LIMIT){child.kill();finish(Error('O clipboard aceita até 100 KB de texto.'));}else chunks.push(chunk);});child.on('close',code=>finish(code===0?null:Error('Não foi possível acessar o clipboard do Mac.'),Buffer.concat(chunks).toString('utf8')));child.stdin.end(input);});}
 return {read:()=>run('/usr/bin/pbpaste'),write:text=>run('/usr/bin/pbcopy',validateClipboardText(text))};
}
export async function browserClipboardAction(input,{actor,rpc,clipboard}){
 if(actor!=='user')throw Error('Clipboard disponível apenas por ação do usuário no painel.');
 if(['clipboardWrite','clipboardPaste'].includes(input.action))validateClipboardText(input.text);
 if(input.action==='clipboardRead')return {text:await clipboard.read()};
 if(input.action==='clipboardWrite'){await clipboard.write(input.text);return {ok:true};}
 const commands={clipboardCopy:'copy',clipboardPaste:'paste',selectAll:'selectAll'},command=commands[input.action];if(!command)throw Error('Ação de clipboard inválida.');
 if(input.action==='clipboardPaste')await clipboard.write(input.text);
 await rpc('Input.dispatchKeyEvent',{type:'keyDown',key:input.action==='selectAll'?'a':input.action==='clipboardCopy'?'c':'v',modifiers:4,commands:[command]});
 await rpc('Input.dispatchKeyEvent',{type:'keyUp',key:input.action==='selectAll'?'a':input.action==='clipboardCopy'?'c':'v',modifiers:4});
 return input.action==='clipboardCopy'?{text:await clipboard.read()}:{ok:true};
}
