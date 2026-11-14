'use strict';
/* PR-only static guard: future MK UI text edits must update English in the same PR.
   Heuristic is intentionally not a substitute for human translation review. */
const {execFileSync}=require('node:child_process');
const base=process.env.GITHUB_BASE_REF;
if(!base){console.log('English sync guard: PR-only; skipping outside pull_request');process.exit(0);}
if(!/^[A-Za-z0-9._/-]{1,100}$/.test(base)){console.error('Invalid base ref');process.exit(1);}
function git(args){return execFileSync('git',args,{encoding:'utf8',maxBuffer:12*1024*1024});}
const range='origin/'+base+'...HEAD';
const paths=git(['diff','--name-only',range,'--','index.html','js','android-template/app/src/main']);
const changedFiles=paths.trim().split('\n').filter(Boolean);
const enChanged=git(['diff','--name-only',range,'--','locales/en.json']).trim().length>0;
const sourceFiles=changedFiles.filter(file=>file==='index.html'||file.startsWith('js/')||file.startsWith('android-template/app/src/main/'));
if(!sourceFiles.length){console.log('English sync guard: no UI-source changes');process.exit(0);}
const diff=git(['diff','--unified=0',range,'--',...sourceFiles]);
const added=diff.split('\n').filter(line=>line.startsWith('+')&&!line.startsWith('+++'))
 .map(line=>line.slice(1)).filter(line=>line.trim()&&!/^\s*(?:\/\/|\/\*|\*|<!--)/.test(line));
const cyrillicText=added.filter(line=>/[А-Яа-яЀ-ӿ]/u.test(line) && /['"`>]/.test(line));
if(cyrillicText.length&&!enChanged){
 console.error('English synchronization required: new/edited Macedonian UI text found, but locales/en.json unchanged.');
 console.error('Changed text-bearing lines:',cyrillicText.slice(0,8).map(line=>line.slice(0,150)));
 console.error('Update locales/en.json (or explain false positive and add explicit QA) in this PR.');
 process.exit(1);
}
console.log('English sync guard: PASS — '+sourceFiles.length+' source files, '+cyrillicText.length+' potential Macedonian UI lines, en catalog changed='+enChanged);
