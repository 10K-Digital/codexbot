import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');

test('panel polling stays passive after failure; explicit opening omits the old target',async()=>{
 const sent=[],errors=[],buttons=[];
 const context={tab:'computer',polling:false,document:{hidden:false},activeTargetId:'old-page',t:x=>x,
  api:async(_,input)=>{sent.push(input);throw Error('not ready');},
  showBrowserError:error=>errors.push(error),
  button:(label,onclick)=>{const button={label,onclick,disabled:false};buttons.push(button);return button;},
  controls:{append:()=>{}},controlToggle:{},
 };
 vm.createContext(context);
 const start=source.indexOf(' async function act(data)'),end=source.indexOf(' const navigate=',start);
 vm.runInContext(source.slice(start,end),context);
 const openStart=source.indexOf(' const openBrowser='),openEnd=source.indexOf('\n',openStart+1);
 vm.runInContext(source.slice(openStart,openEnd),context);
 for(let i=0;i<5;i++)await context.capture();
 assert.deepEqual(sent.map(input=>input.action),Array(5).fill('screenshot'));
 assert.equal(errors.length,5);
 await buttons[0].onclick();assert.equal(sent.at(-1).action,'open');assert.equal(sent.at(-1).targetId,undefined);
 assert.equal(buttons[0].disabled,false);
});
