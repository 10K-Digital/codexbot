const tabs=new Set(['chat','skills','routines','activity','computer']);
export function createTabMemory(storage){
 let saved={};try{const value=JSON.parse(storage.getItem('equipe-agent-tabs')||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))saved=value;}catch{}
 return {get(id){return Object.hasOwn(saved,id)&&tabs.has(saved[id])?saved[id]:'chat';},set(id,tab){if(!tabs.has(tab))return false;saved={...saved,[id]:tab};try{storage.setItem('equipe-agent-tabs',JSON.stringify(saved));}catch{}return true;}};
}
