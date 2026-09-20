import fs from 'node:fs/promises';
import path from 'node:path';
import {constants} from 'node:fs';
import {markdownLinks,localFileTarget} from './dist/file-links.mjs';
import {fileType} from './attachments.mjs';
const LIMIT=8*1024*1024;
export async function previewMessageFile({message,target,workspace}){
 if(!message||!markdownLinks(message.text).some(link=>link.target===target))throw Error('Este arquivo não está vinculado à mensagem.');
 const local=localFileTarget(target);if(!local)throw Error('Link de arquivo inválido.');
 const base=await fs.realpath(workspace),candidate=path.resolve(base,local);
 const forbidden=relative=>relative.split(path.sep).some(p=>p==='..'||p==='.private'||p==='.git'||/^\.env(?:\.|$)/.test(p)||/^(?:device-token|credentials|id_rsa|id_ed25519)(?:\.|$)/i.test(p));
 let resolved;try{resolved=await fs.realpath(candidate);}catch{throw Error('Arquivo não encontrado. Peça ao agente para gerar ou anexar o arquivo novamente.');}
 const relative=path.relative(base,resolved);if(!relative||path.isAbsolute(relative)||forbidden(relative))throw Error('Este arquivo não pode ser aberto na prévia.');
 const handle=await fs.open(resolved,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const stat=await handle.stat();if(!stat.isFile())throw Error('Este link aponta para uma pasta, não para um arquivo.');
  if(stat.size>LIMIT)throw Error('O arquivo é grande demais para a prévia (limite de 8 MB). Peça ao agente uma versão menor.');
  const bytes=Buffer.alloc(LIMIT+1);let length=0;
  while(length<bytes.length){const read=await handle.read(bytes,length,bytes.length-length,null);if(!read.bytesRead)break;length+=read.bytesRead;}
  if(length>LIMIT)throw Error('O arquivo é grande demais para a prévia (limite de 8 MB).');
  const data=bytes.subarray(0,length),name=path.basename(resolved),mime=fileType(name,data);
  const textExtensions=/\.(?:txt|md|csv|json|jsonl|log|yaml|yml|xml|html|css|js|mjs|ts|tsx|jsx|py|sh|toml|ini|sql)$/i;
  if((mime==='text/plain'||textExtensions.test(name))&&!data.includes(0))return {name,mime:'text/plain',text:data.toString('utf8')};
  return {name,mime,data:data.toString('base64')};
 }finally{await handle.close();}
}
