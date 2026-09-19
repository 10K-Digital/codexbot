import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeBrowserURL} from '../dist/browser-url.mjs';
import {virtualBrowser} from '../virtual-browser.mjs';
test('address bar defaults to HTTPS and preserves explicit HTTP, paths and ports',()=>{
 for(const [input,expected] of [
  ['google.com','https://google.com/'],['  example.com/path?q=yes#part  ','https://example.com/path?q=yes#part'],
  ['https://example.com','https://example.com/'],['HTTP://localhost:4320/path','http://localhost:4320/path'],
  ['localhost:4320','https://localhost:4320/'],['example.com:8443/path','https://example.com:8443/path'],
  ['127.0.0.1:4320','https://127.0.0.1:4320/'],['[::1]:4320','https://[::1]:4320/'],
  ['//example.com/path','https://example.com/path'],['exemplo.com.br','https://exemplo.com.br/']
 ])assert.equal(normalizeBrowserURL(input),expected);
});
test('unsafe schemes, credentials and malformed addresses are rejected before browser startup',async()=>{
 const browser=virtualBrowser('/unused-test-browser');
 for(const input of ['',null,{},'javascript:alert(1)','javascript:123','data:text/html,hello','file:///tmp/file','chrome://settings','ftp://example.com','http:example.com','user:pass@example.com','https://user:pass@example.com','https://','bad host.com','/path','example.com\\path','example.com\n/path']){
  assert.throws(()=>normalizeBrowserURL(input));await assert.rejects(browser.action({action:'navigate',url:input}),/HTTP ou HTTPS/);
 }
});
