import test from 'node:test';
import assert from 'node:assert/strict';
import {t} from '../dist/i18n.mjs';
import {approvalPresentation,renderApproval} from '../dist/cards.mjs';
const request=params=>({method:'mcpServer/elicitation/request',params});
test('authentication failures show the connector and a safe reconnection link',()=>{
 const v=approvalPresentation(request({mode:'url',url:'https://example.com/reconnect',threadId:'private-id',_meta:{_codex_apps:{connector_auth_failure:{is_auth_failure:true,connector_name:'Rube'}}}}));
 assert.equal(v.kind,'link');assert.equal(v.auth,true);assert.equal(v.name,'Rube');assert.equal(v.url,'https://example.com/reconnect');assert.ok(!JSON.stringify(v).includes('private-id'));
});
test('unsafe authentication links are not actionable',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','invalid'])assert.equal(approvalPresentation(request({mode:'url',url})).url,null);
});
test('simple connector fields are supported, nested fields fail closed',()=>{
 assert.equal(approvalPresentation(request({requestedSchema:{type:'object',properties:{name:{type:'string'},count:{type:'integer'},confirmed:{type:'boolean'}}}})).supported,true);
 assert.equal(approvalPresentation(request({requestedSchema:{type:'object',properties:{nested:{type:'object'}}}})).supported,false);
});
test('unknown requests never fall back to exposing raw parameters',()=>{
 const v=approvalPresentation({method:'unknown',params:{threadId:'secret',message:'{"secret":true}'}});
 assert.equal(v.details,'');assert.ok(!JSON.stringify(v).includes('secret'));
});
class Node {constructor(tag,attrs={},text=''){this.tag=tag;this.attrs=attrs;this.text=text;this.children=[];}append(...nodes){this.children.push(...nodes);}querySelectorAll(tag){return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.querySelectorAll(tag)]);}reportValidity(){return true;}setAttribute(k,v){this.attrs[k]=v;}}
const el=(...args)=>new Node(...args);
const button=(text,click,cls)=>{const n=el('button',{class:cls},text);n.click=click;return n;};
test('reconnection has explicit manual actions and sends only the selected decision',async()=>{
 const sent=[];const card=renderApproval(request({mode:'url',url:'https://example.com/reconnect',_meta:{_codex_apps:{connector_auth_failure:{is_auth_failure:true,connector_name:'Rube'}}}}),{el,button,submit:async p=>sent.push(p)});
 assert.equal(card.querySelectorAll('a')[0].text,t('Reconectar {name}',{name:'Rube'}));assert.equal(sent.length,0);
 const confirm=card.querySelectorAll('button').find(n=>n.text===t('Já reconectei — tentar novamente'));assert.ok(confirm);await confirm.click();assert.deepEqual(sent,[{approved:true}]);
});
test('missing reconnection link offers refusal but no blind approval',()=>{
 const card=renderApproval(request({mode:'url'}),{el,button,submit:async()=>{}});
 assert.equal(card.querySelectorAll('a').length,0);assert.deepEqual(card.querySelectorAll('button').map(n=>n.text),[t('Não continuar')]);
});
