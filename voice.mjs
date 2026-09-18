import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
export const MAX_AUDIO=12*1024*1024;
export function createVoice({root,execute=execFile}){
 const python=path.join(root,'.private/voice-env/bin/python'),model=path.join(root,'.private/voice-model/model.bin');let busy=false;
 const status=()=>({available:fs.existsSync(python)&&fs.existsSync(model),engine:'local-whisper',maxSeconds:180});
 async function transcribe(stream,language){
  if(!status().available)throw Error('Instale a transcrição local no Mac: npm run setup:voice');
  if(busy)throw Error('Uma transcrição já está em andamento.');busy=true;
  const directory=path.join(root,'.runtime/voice');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const file=path.join(directory,randomUUID());let handle;
  try{handle=await fs.promises.open(file,'wx',0o600);let size=0;
   for await(const chunk of stream){size+=chunk.length;if(size>MAX_AUDIO)throw Error('Áudio muito grande. Use até 12 MB e 3 minutos.');await handle.writeFile(chunk);}
   await handle.close();handle=null;if(!size)throw Error('O áudio está vazio.');
   const text=await new Promise((resolve,reject)=>execute(python,[path.join(root,'scripts/transcribe.py'),file,['pt','en','es'].includes(language)?language:'auto'],{timeout:180000,maxBuffer:1024*1024,env:{...process.env,HF_HUB_OFFLINE:'1'}},(error,stdout)=>error?reject(Error('Não foi possível transcrever este áudio. Use até 3 minutos.')):resolve(stdout)));
   const result=JSON.parse(text);if(typeof result.text!=='string'||!result.text.trim())throw Error('Não foi detectada fala. Tente gravar novamente.');return {text:result.text.slice(0,20000),language:result.language};
  }finally{if(handle)await handle.close();fs.rmSync(file,{force:true});busy=false;}
 }
 return {status,transcribe};
}
