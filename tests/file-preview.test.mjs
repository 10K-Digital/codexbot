import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {markdownLinks,localFileTarget} from '../dist/file-links.mjs';
import {previewMessageFile} from '../file-preview.mjs';
test('markdown file destinations support spaces, parentheses, encoding and line references',()=>{
 const links=markdownLinks('Estado [sync_state.json](</workspace/Application Support/sync_state.json>). [Other](report(1).md) [Web](https://example.com)');
 assert.equal(links.length,3);assert.equal(links[0].target,'/workspace/Application Support/sync_state.json');assert.equal(links[1].target,'report(1).md');
 assert.equal(localFileTarget('file:///workspace/a%20b.json:12'),'/workspace/a b.json');assert.equal(localFileTarget('file:///workspace/a.md#L4'),'/workspace/a.md');
 for(const value of ['https://example.com','javascript:alert(1)','data:text/html,x','//example.com/a','file://remote/etc/passwd'])assert.equal(localFileTarget(value),null);
});
test('preview renders referenced workspace text inertly, handles missing files and blocks escape',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'preview-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const workspace=path.join(root,'agent');await fs.mkdir(workspace);
 const load=target=>previewMessageFile({workspace,target,message:{text:`[file](<${target}>)`}});
 await fs.writeFile(path.join(workspace,'state file.json'),' {"ok":true}');
 assert.equal((await load('state file.json')).text,' {"ok":true}');assert.equal((await load(path.join(workspace,'state file.json'))).name,'state file.json');
 await fs.writeFile(path.join(workspace,'page.html'),'<script>alert(1)</script>');assert.equal((await load('page.html')).mime,'text/plain');
 await assert.rejects(previewMessageFile({workspace,target:'state file.json',message:{text:'no link'}}),/vinculado/);
 await assert.rejects(load('missing.json'),/não encontrado/);
 await fs.writeFile(path.join(root,'outside.txt'),'private');await assert.rejects(load('../outside.txt'),/não pode/);
 await fs.symlink(path.join(root,'outside.txt'),path.join(workspace,'linked.txt'));await assert.rejects(load('linked.txt'),/não pode/);
 await fs.writeFile(path.join(workspace,'.env'),'SECRET');await assert.rejects(load('.env'),/não pode/);
 await fs.writeFile(path.join(workspace,'huge.txt'),Buffer.alloc(8*1024*1024+1));await assert.rejects(load('huge.txt'),/grande demais/);
 await fs.writeFile(path.join(workspace,'image.png'),Buffer.from([137,80,78,71,13,10,26,10]));assert.equal((await load('image.png')).mime,'image/png');
});
