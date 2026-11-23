import {execFileSync} from "node:child_process";
// Generate content-addressed optional packs without changing the source checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {digest,validContentPath} from '../server/content-cache.mjs';
const assets=JSON.parse(await fs.readFile('public/data/assets.json'));
const essential=new Set();
function scan(value){if(typeof value==='string'){const local=assets[value]||value;if(local.startsWith('/assets/'))essential.add(local.slice(1))}else if(Array.isArray(value))value.forEach(scan);else if(value&&typeof value==='object')Object.values(value).forEach(scan)}
for(const p of ['maps.json','map-detail.json','map-styles.json','event-content.json']){try{scan(JSON.parse(await fs.readFile('public/data/'+p)))}catch{}}
for(const prefix of ['maps','pve/maps','en/maps','en/pve/maps']){try{for(const n of await fs.readdir('public/data/'+prefix))scan(JSON.parse(await fs.readFile('public/data/'+prefix+'/'+n)))}catch{}}
const files=[],pending=[];let excludedBytes=0;const excluded=[];
async function walk(dir){for(const e of await fs.readdir('public/'+dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isSymbolicLink())throw Error('Symlink in content');if(e.isDirectory()){await walk(p);continue}if(/^data\/(source|tiles-cache)\//.test(p)){excluded.push('public/'+p);excludedBytes+=(await fs.stat('public/'+p)).size;continue}
 const optionalData=/^data\/(?:en\/)?(?:pve\/)?(?:items|quests|articles)\//.test(p);
 const optionalImage=p.startsWith('assets/')&&!essential.has(p)&&!/^assets\/(?:map-|tiles-|news\/|graphics-previews\/|event-guides\/|eft-gps-markers\/|secret-maps-markers\/)/.test(p);
 if((optionalData||optionalImage)&&validContentPath(p))pending.push(p);
}}
await walk('data');await walk('assets');let cursor=0;await Promise.all(Array.from({length:8},async()=>{for(;;){const p=pending[cursor++];if(!p)return;const b=await fs.readFile('public/'+p);files.push({path:p,size:b.length,sha256:digest(b)});if(files.length%5000===0)console.log('Hashed',files.length)}}));files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
const revision=digest(JSON.stringify(files)),dir=`outputs/ContentPacks/${revision.slice(0,16)}`;await fs.mkdir(dir,{recursive:true});
const buckets=new Map();for(const f of new Map(files.map(f=>[f.sha256,f])).values()){const k=digest(f.path).slice(0,2);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(f)}
const packs=[];for(const bucket of buckets.values()){let group=[],size=0;async function flush(){if(!group.length)return;const entries=[];for(const f of group)entries.push({path:f.path,data:(await fs.readFile('public/'+f.path)).toString('base64')});const b=gzipSync(JSON.stringify({files:entries}),{level:6}),name=digest(b)+'.gz';await fs.writeFile(path.join(dir,name),b);packs.push({name,size:b.length,files:group.map(f=>f.path)});group=[];size=0}
 for(const f of bucket){if(group.length>=256||size+f.size>8*1024*1024)await flush();group.push(f);size+=f.size}await flush()}
const sourceCommit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const retained=[];for(const entry of JSON.parse(await fs.readFile('distribution/package-files.json','utf8')).files){if(/^public\/data\/(?:en\/)?(?:(?:regular|pve)\/(?:items|quests|quest-search|tracker)|assets|lookup|articles|categories|manifest|modifiers|tracker|index|strings)\.json$/.test(entry.path)){const b=await fs.readFile(entry.path);retained.push({path:entry.path.slice(7),size:b.length,sha256:digest(b),retain:true})}}
const catalog={format:1,revision,sourceCommit,dataRevision:digest(JSON.stringify(retained)),retained,files,packs};await fs.writeFile('public/data/content-catalog.json',JSON.stringify(catalog));await fs.mkdir('work',{recursive:true});await fs.writeFile('work/content-excluded.json',JSON.stringify([...excluded,...files.map(f=>'public/'+f.path)]));
console.log(JSON.stringify({revision,files:files.length,packs:packs.length,optionalBytes:files.reduce((n,f)=>n+f.size,0),excludedSourceBytes:excludedBytes,packBytes:packs.reduce((n,p)=>n+p.size,0)}));
