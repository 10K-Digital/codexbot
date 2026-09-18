import {messages} from './translations.mjs';
export const supportedLanguages=['pt','en','es'];
export function detectLanguage(languages=[]){for(const value of languages){const base=String(value).toLowerCase().split(/[-_]/)[0];if(supportedLanguages.includes(base))return base;}return 'en';}
export function resolveLanguage(preference,languages=[]){return supportedLanguages.includes(preference)?preference:detectLanguage(languages);}
export function translate(key,language,params={}){key=String(key??'');const template=messages[key]?.[language]??key;return template.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(params,name)?String(params[name]):match);}
export function storedPreference(){try{return localStorage.getItem('equipe-language')||'auto';}catch{return 'auto';}}
export function browserLanguages(){return typeof navigator==='undefined'?[]:navigator.languages?.length?navigator.languages:[navigator.language];}
export function currentLanguage(){return resolveLanguage(storedPreference(),browserLanguages());}
export function locale(){return {pt:'pt-BR',en:'en-US',es:'es-ES'}[currentLanguage()];}
export function t(key,params){return translate(key,currentLanguage(),params);}
export function translateStatic(root=document){document.documentElement.lang=locale();const manifest=document.querySelector('link[rel=manifest]');if(manifest)manifest.href='/manifest.'+currentLanguage()+'.webmanifest';for(const node of root.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);for(const node of root.querySelectorAll('[data-i18n-attrs]')){const attrs=JSON.parse(node.dataset.i18nAttrs);for(const [name,key]of Object.entries(attrs))node.setAttribute(name,t(key));}}
