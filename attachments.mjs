import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export const MAX_FILE=100*1024*1024;
export function safeName(value){return String(value||'arquivo').split(/[\\/]/).at(-1).replace(/[\x00-\x1f\x7f]/g,'').slice(0,180)||'arquivo';}
export function fileType(name,bytes){
 const ext=path.extname(name).toLowerCase();
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(/^GIF8[79]a/.test(bytes.subarray(0,6).toString()))return 'image/gif';
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
 if(bytes.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
 if(bytes.subarray(4,8).toString()==='ftyp')return ['.m4a','.aac'].includes(ext)?'audio/mp4':'video/mp4';
 if(bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])))return ext==='.weba'?'audio/webm':'video/webm';
 if(bytes.subarray(0,4).toString()==='OggS')return ext==='.ogv'?'video/ogg':'audio/ogg';
 if(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224)return 'audio/mpeg';
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE')return 'audio/wav';
 if(['.txt','.md','.csv','.json','.log'].includes(ext)&&!bytes.includes(0))return 'text/plain';
 return 'application/octet-stream';
}
export function byteRange(header,size){if(!header)return null;const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||(!m[1]&&!m[2]))throw Error('Range inválido');let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]?(m[2]?Number(m[2]):size-1):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start> end||start>=size)throw Error('Range inválido');return {start,end:Math.min(end,size-1)};}
export function createAttachmentStore({directory,records,persist,frameOrigins=[]}){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 async function upload(iterable,name,owner='owner'){
  if(Object.values(records).reduce((n,f)=>n+f.size,0)>=2*1024*1024*1024)throw Error('O armazenamento de anexos atingiu 2 GB.');
  const id=randomUUID(),file=path.join(directory,id),handle=await fs.promises.open(file,'wx',0o600);let size=0,head=Buffer.alloc(0);
  try{for await(const chunk of iterable){const b=Buffer.from(chunk);size+=b.length;if(size>MAX_FILE)throw Error('O limite por arquivo é 100 MB.');if(head.length<4096)head=Buffer.concat([head,b.subarray(0,4096-head.length)]);let offset=0;while(offset<b.length){const {bytesWritten}=await handle.write(b,offset,b.length-offset);if(!bytesWritten)throw Error('Falha ao gravar arquivo.');offset+=bytesWritten;}}if(!size)throw Error('Arquivo vazio.');}
  catch(e){await handle.close();fs.rmSync(file,{force:true});throw e;}
  await handle.close();const filename=safeName(name);const record={id,name:filename,size,mime:fileType(filename,head),owner,createdAt:new Date().toISOString()};records[id]=record;persist();return publicFile(record);
 }
 function get(id,owner){const f=records[id];if(!f||(owner&&f.owner!==owner))throw Error('Anexo não encontrado.');return f;}
 function publicFile(f){return {id:f.id,name:f.name,size:f.size,mime:f.mime};}
 function materialize(ids,owner,cwd){const dir=path.join(cwd,'anexos');fs.mkdirSync(dir,{recursive:true,mode:0o700});return ids.map(id=>{const f=get(id,owner),dest=path.join(dir,id+'-'+f.name);if(!fs.existsSync(dest))fs.copyFileSync(path.join(directory,id),dest);return {...publicFile(f),path:dest};});}
 function serve(req,res,id){const f=get(id),file=path.join(directory,id);let range;try{range=byteRange(req.headers.range,f.size);}catch{res.writeHead(416,{'Content-Range':`bytes */${f.size}`});res.end();return;}
  const inline=/^(image\/(png|jpeg|gif|webp)|audio\/|video\/|application\/pdf|text\/plain)/.test(f.mime)&&!new URL(req.url,'http://localhost').searchParams.has('download');
  res.setHeader('Content-Type',f.mime);res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`);res.setHeader('Accept-Ranges','bytes');res.setHeader('X-Content-Type-Options','nosniff');
  res.removeHeader('X-Frame-Options');res.setHeader('Content-Security-Policy',`default-src 'none'; sandbox; frame-ancestors 'self' ${frameOrigins.map(value=>new URL(value).origin).join(' ')}`);
  if(range){res.writeHead(206,{'Content-Range':`bytes ${range.start}-${range.end}/${f.size}`,'Content-Length':range.end-range.start+1});}else res.writeHead(200,{'Content-Length':f.size});
  if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file,range||{});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 }
 return {upload,get,publicFile,materialize,serve};
}
