import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const issues=[];
for(const file of files){
 if(/(^|\/)(\.private|\.runtime|\.openai|buzz-harnesses|memory|memories|node_modules)(\/|$)|(^|\/)\.env($|\.)|(^|\/)config\.js$|\.(pem|key|p12|pfx|bundle)$/.test(file)){issues.push(file+': private/generated path');continue;}
 if(/\.(png|jpg|jpeg|gif|webp|ico)$/.test(file))continue;
 const source=execFileSync('git',['show',':'+file],{encoding:'utf8',maxBuffer:10*1024*1024});
 const checks=[['absolute home path',/\/Users\/[a-zA-Z0-9._-]+\//],['private tailnet address',/\.tail[a-f0-9]+\.ts\.net/],['personal Sites address',/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.chatgpt\.site/],['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['provider token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-proj-[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9]{40,})\b/]];
 for(const [label,pattern]of checks)if(pattern.test(source))issues.push(file+': '+label);
}
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
console.log('Tracked source check passed. Review manually too; pattern checks cannot detect every secret.');
