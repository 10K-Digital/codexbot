import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const run=(command,args)=>{const r=spawnSync(command,args,{cwd:root,stdio:'inherit'});if(r.error||r.status!==0)throw Error('Voice setup failed: '+command);};
run('uv',['venv','.private/voice-env','--python','3.12']);
run('uv',['pip','install','--python','.private/voice-env/bin/python','faster-whisper==1.2.1']);
run(path.join(root,'.private/voice-env/bin/python'),['-c',"from faster_whisper.utils import download_model; download_model('base', output_dir='.private/voice-model')"]);
console.log('Local voice is ready. Audio is processed on this computer.');
