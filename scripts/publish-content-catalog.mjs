// Publish a tiny data branch without changing the current checkout or main.
// History is append-only. The corresponding immutable packs must already be public.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateCatalog} from '../server/content-cache.mjs';
const run=(args,input)=>execFileSync('git',args,{input,encoding:'utf8',maxBuffer:32*1024**2,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}}).trim();
const bytes=fs.readFileSync('public/data/content-catalog.json'),catalog=validateCatalog(JSON.parse(bytes));
if(!catalog.sourceCommit)throw Error('The content source must be pinned to a commit');
const original=JSON.parse(run(['show',catalog.sourceCommit+':distribution/package-files.json']));
const files=new Map(original.files.map(f=>[f.path,f]));
for(const f of [...catalog.files,...(catalog.retained||[])]){const prior=files.get('public/'+f.path);if(prior?.sha256!==f.sha256||prior.size!==f.size)throw Error('Uncommitted content in catalogue: '+f.path)}
if(!process.argv.includes('--publish')){console.log('Verified pinned catalogue',catalog.revision);process.exit(0)}
const release=await fetch('https://api.github.com/repos/TsuyuDX/eft-gps/releases/tags/data-'+catalog.revision.slice(0,16),{signal:AbortSignal.timeout(30000)});
if(!release.ok||(await release.json()).draft)throw Error('Publish and verify content packs first');
const remote=run(['ls-remote','--heads','origin','content-data']);let parent;
if(remote){parent=remote.split(/\s/)[0];run(['fetch','--no-tags','origin','content-data'])}
const blob=run(['hash-object','-w','--stdin'],bytes),tree=run(['mktree'],`100644 blob ${blob}\tcatalog.json\n`);
const commit=run(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m','Publish verified optional content catalogue '+catalog.revision.slice(0,16)]);
run(['push','origin',commit+':refs/heads/content-data']);
if(!run(['ls-remote','--heads','origin','content-data']).startsWith(commit))throw Error('Remote catalogue commit not confirmed');
console.log('Published catalogue commit:',commit);
