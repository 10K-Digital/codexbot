// Only the known legacy import wrapper is expanded. User-authored links are left alone.
const marker='Use as regras operacionais da [referência importada](source.md).';
export function isImportedWrapper(instructions){return typeof instructions==='string'&&instructions.includes(marker);}
export function inlineImportedInstructions(instructions,source){
 if(!isImportedWrapper(instructions))return instructions;
 if(typeof source!=='string'||!source.trim()||isImportedWrapper(source))throw Error('A referência completa da skill importada não está disponível.');
 const full=instructions.replace(marker,source.trim());
 if(full.length>100000)throw Error('As instruções completas excedem o limite da skill.');
 return full;
}
