// CommonMark angle destinations preserve spaces; ordinary destinations may contain parentheses.
export function markdownLinks(text){
 const result=[],re=/\[([^\]\n]+)\]\(\s*(?:<([^>\n]+)>|((?:[^\s()]+|\([^()]*\))+))\s*\)/g;
 for(const m of String(text).matchAll(re))result.push({label:m[1],target:m[2]||m[3],index:m.index,length:m[0].length});
 return result;
}
export function localFileTarget(target){
 if(typeof target!=='string'||!target||/[\x00-\x1f]/.test(target))return null;
 let value=target;
 if(value.startsWith('file://')){try{const u=new URL(value);if(u.hostname&&u.hostname!=='localhost')return null;value=decodeURIComponent(u.pathname);}catch{return null;}}
 else {if(/^[a-z][a-z\d+.-]*:/i.test(value)||value.startsWith('//')||value.startsWith('#'))return null;try{value=decodeURIComponent(value);}catch{return null;}}
 value=value.replace(/(?::\d+(?::\d+)?|#L\d+(?:C\d+)?(?:-L?\d+)?)$/,'');
 return value||null;
}
