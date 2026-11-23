// Explicit maintenance command. Uses the existing Git credential helper or GH_TOKEN;
// credentials remain in memory and are never saved or printed. No retry loops.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateCatalog,digest} from '../server/content-cache.mjs';
const catalog=validateCatalog(JSON.parse(await fs.readFile('public/data/content-catalog.json','utf8')));
const tag='data-'+catalog.revision.slice(0,16),dir=path.resolve('outputs/ContentPacks/'+catalog.revision.slice(0,16));
for(const pack of catalog.packs){const b=await fs.readFile(path.join(dir,pack.name));if(b.length!==pack.size||digest(b)+'.gz'!==pack.name)throw Error('Local content pack verification failed')}
console.log('Verified',catalog.packs.length,'packs for',tag);
if(!process.argv.includes('--publish'))process.exit(0);
let token=process.env.GH_TOKEN;
if(!token){const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},stdio:['pipe','pipe','pipe']});token=Object.fromEntries(raw.trim().split('\n').map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)]})).password}
if(!token)throw Error('GitHub authentication required');
const base='https://api.github.com/repos/TsuyuDX/eft-gps';
const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'EFT-GPS-content-publisher'};
async function api(url,options={}){const response=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(180000)});if(response.status===404&&options.missing)return null;const data=await response.json();if(!response.ok)throw Error(`GitHub ${response.status}: ${data.message||'stopped'}`);return data}
const pause=()=>new Promise(r=>setTimeout(r,1600));
let release=await api(base+'/releases/tags/'+tag,{missing:true});
if(!release){const drafts=(await api(base+'/releases?per_page=100')).filter(r=>r.draft&&r.tag_name===tag);if(drafts.length>1)throw Error('Multiple matching drafts; refusing to replace assets');release=drafts[0]||null}
if(!release){await pause();release=await api(base+'/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,target_commitish:'main',name:'Optional offline content · '+tag.slice(5),body:'Optional quest details and illustrations for EFT GPS hybrid storage. Not an application installer. Packs are verified against the SHA-256 content catalogue. Existing maps and GPS stay offline.',draft:true,prerelease:true,make_latest:'false'})})}
const existing=new Map();for(let page=1;page<=20;page++){const assets=await api(base+`/releases/${release.id}/assets?per_page=100&page=${page}`);for(const a of assets)existing.set(a.name,a);if(assets.length<100)break}
let done=0;for(const pack of catalog.packs){const prior=existing.get(pack.name);if(prior){if(prior.size!==pack.size||prior.digest!=='sha256:'+pack.name.slice(0,64)||prior.state!=='uploaded')throw Error('Existing published asset does not match. No asset was replaced.')}else{
 await pause();const asset=await api(`https://uploads.github.com/repos/TsuyuDX/eft-gps/releases/${release.id}/assets?name=${encodeURIComponent(pack.name)}`,{method:'POST',headers:{'Content-Type':'application/gzip','Content-Length':String(pack.size)},body:await fs.readFile(path.join(dir,pack.name))});if(asset.size!==pack.size||asset.digest!=='sha256:'+pack.name.slice(0,64))throw Error('Uploaded asset checksum mismatch');
 }if(++done%10===0)console.log('Verified uploads',done,'/',catalog.packs.length)}
if(release.draft){await pause();release=await api(base+`/releases/${release.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:false,prerelease:true,make_latest:'false'})})}
console.log('Published content:',release.html_url);
