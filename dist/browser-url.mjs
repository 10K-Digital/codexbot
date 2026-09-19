export function normalizeBrowserURL(value){
 const error=()=>{throw Error('Use um endereço HTTP ou HTTPS válido.');};
 if(typeof value!=='string')return error();
 let input=value.trim();if(!input||/[\u0000-\u0020\u007f\\]/.test(input))return error();
 if(input.startsWith('//'))input='https:'+input;
 else if(!/^https?:\/\//i.test(input)){
  // A host with a numeric port is not a URI scheme (localhost:4320, example.com:8443).
  if(/^(?:https?|javascript|vbscript|data|file|ftp|about|chrome):/i.test(input)||input.startsWith('/'))return error();
  if(/^[a-z][a-z\d+.-]*:/i.test(input)&&!/^([^/:?#]+|\[[a-f\d:]+\]):\d+(?:[/?#]|$)/i.test(input))return error();
  input='https://'+input;
 }
 let url;try{url=new URL(input);}catch{return error();}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname)return error();
 return url.href;
}
