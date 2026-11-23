// Optional reference content. Maps/GPS and catalogue summaries remain bundled.
// Remote bytes are accepted only after matching the versioned SHA-256 catalogue.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const origin='https://raw.githubusercontent.com/TsuyuDX/eft-gps/';
const catalogUrl=origin+'content-data/catalog.json';
const maxFile=32*1024*1024;
export const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
export function validContentPath(p){return typeof p==='string'&&p.length<240&&/^(?:data|assets)\/[A-Za-z0-9_./()+@%-]+\.(?:json|png|jpg|jpeg|webp)$/.test(p)&&!p.split('/').some(s=>!s||s==='.'||s==='..'||/%/i.test(s));}
export function validateCatalog(value){
 if(value?.format!==1||!Array.isArray(value.files)||value.files.length>100000||!Array.isArray(value.packs)||value.packs.length>2000)throw Error('Invalid content catalogue');
 if(value.sourceCommit!==undefined&&!/^[a-f0-9]{40}$/.test(value.sourceCommit))throw Error('Invalid source commit');
 if(value.retained!==undefined&&(!Array.isArray(value.retained)||value.retained.length>100||value.retained.some(f=>f.retain!==true||!f.path?.startsWith('data/')||!f.path.endsWith('.json'))))throw Error('Invalid retained content');
 const seen=new Set();let bytes=0;
 for(const f of [...value.files,...(value.retained||[])]){if(!validContentPath(f.path)||seen.has(f.path)||!Number.isSafeInteger(f.size)||f.size<1||f.size>maxFile||!/^\w{64}$/.test(f.sha256)||!/^[a-f0-9]+$/.test(f.sha256))throw Error('Invalid content file');seen.add(f.path);bytes+=f.size}
 if(bytes>4*1024**3)throw Error('Content catalogue too large');
 for(const p of value.packs){if(!/^[a-f0-9]{64}\.gz$/.test(p.name)||!Number.isSafeInteger(p.size)||p.size<1||p.size>maxFile||!Array.isArray(p.files)||p.files.length>512||!p.files.every(f=>seen.has(f))||new Set(p.files).size!==p.files.length)throw Error('Invalid content pack')}
 if(typeof value.revision!=='string'||!/^[a-f0-9]{64}$/.test(value.revision))throw Error('Invalid content revision');
 return value;
}
export class ContentCache{
 constructor(root,{fetcher=fetch,network=process.env.EFTGPS_NO_CONTENT_NETWORK!=='1'}={}){
  this.root=root;this.public=path.join(root,'public');this.dir=path.join(root,'userdata/content-cache');this.fetcher=fetcher;this.network=network;this.inflight=new Map();this.verified=new Map();this.jobs=0;this.stalePaths=new Set();
  this.status={phase:'idle',done:0,total:0,bytes:0,totalBytes:0,error:'',checkedAt:null};this.ready=this.load();
 }
 async directory(){
  for(const d of [path.join(this.root,'userdata'),this.dir]){await fs.mkdir(d,{recursive:true});const s=await fs.lstat(d);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Unsafe content cache directory')}
 }
 async load(){await this.directory();this.catalog=validateCatalog(JSON.parse(await fs.readFile(path.join(this.public,'data/content-catalog.json'),'utf8')));this.fallbackIndex=new Map([...this.catalog.files,...(this.catalog.retained||[])].map(f=>[f.path,f]));try{const previous=validateCatalog(JSON.parse(await fs.readFile(path.join(this.dir,'catalog.previous.json'),'utf8')));for(const f of [...previous.files,...(previous.retained||[])])this.fallbackIndex.set(f.path,f)}catch{}try{const saved=validateCatalog(JSON.parse(await fs.readFile(path.join(this.dir,'catalog.json'),'utf8')));this.catalog=saved}catch{}this.index=new Map([...this.catalog.files,...(this.catalog.retained||[])].map(f=>[f.path,f]));this.cacheNames=new Set(await fs.readdir(this.dir));this.hasShipped=await fs.stat(path.join(this.public,this.catalog.files[0]?.path||"missing")).then(()=>true,()=>false);}
 async atomic(file,bytes){await this.directory();const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,bytes,{flag:'wx'});await fs.rename(temp,file);this.cacheNames?.add(path.basename(file))}finally{await fs.unlink(temp).catch(()=>{})}}
 cachePath(f){return path.join(this.dir,f.sha256)}
 async valid(file,f,base){
  try{const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size!==f.size)return false;const real=await fs.realpath(file),canonical=await fs.realpath(base);if(!real.startsWith(canonical+path.sep))return false;const signature=s.mtimeMs+':'+s.size+':'+f.sha256;if(this.verified.get(file)===signature)return true;if(digest(await fs.readFile(file))!==f.sha256)return false;this.verified.set(file,signature);return true}catch{return false}
 }
 async local(f){const cached=this.cachePath(f);if(this.cacheNames.has(path.basename(cached))&&await this.valid(cached,f,this.dir))return cached;if(!this.hasShipped&&!f.retain)return null;const shipped=path.join(this.public,f.path);if(await this.valid(shipped,f,this.public))return shipped;return null}
 async bytes(url,limit,signal){
  if(!this.network)throw Error('Нет подключения: материал ещё не сохранён. / Content is not cached for offline use.');
  const timeout=AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(45000)]);
  let response;
  for(let n=0;n<4;n++){
    response=await this.fetcher(url,{redirect:'manual',signal:timeout});
    if(![301,302,303,307,308].includes(response.status))break;
    const next=new URL(response.headers.get('location'),url);
    if(next.protocol!=='https:'||next.username||next.password||!['github.com','raw.githubusercontent.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(next.hostname))throw Error('Unsafe content redirect');
    await response.body?.cancel();url=next.href;
  }
  if(!response.ok)throw Error(`Сервер материалов: HTTP ${response.status}`);
  if(Number(response.headers.get('content-length'))>limit)throw Error('Content exceeds size limit');
  let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('Content exceeds size limit');chunks.push(chunk)}return Buffer.concat(chunks);
 }
 async file(relative,signal){await this.ready;const f=this.index.get(relative);if(!f)return null;const local=await this.local(f);if(local){this.stalePaths.delete(relative);return local;}
  if(!this.inflight.has(f.sha256))this.inflight.set(f.sha256,(async()=>{try{const bytes=await this.bytes(origin+(this.catalog.sourceCommit||'main')+'/public/'+relative,f.size,signal);if(bytes.length!==f.size||digest(bytes)!==f.sha256)throw Error('Контрольная сумма материала не совпадает. Сохранённая база не изменена.');if(relative.endsWith('.json'))JSON.parse(bytes);const target=this.cachePath(f);await this.atomic(target,bytes);this.stalePaths.delete(relative);return target}catch(e){const previous=this.fallbackIndex.get(relative);const fallback=previous&&await this.local(previous);if(fallback){this.stalePaths.add(relative);return fallback}throw e}finally{this.inflight.delete(f.sha256)}})());return this.inflight.get(f.sha256);
 }
 async check(){await this.ready;if(this.downloading)return this.state();if(this.checking)return this.checking;return this.checking=(async()=>{try{const b=await this.bytes(catalogUrl,12*1024*1024);const c=validateCatalog(JSON.parse(b));if(c.revision!==this.catalog.revision||c.dataRevision!==this.catalog.dataRevision){await this.atomic(path.join(this.dir,'catalog.previous.json'),Buffer.from(JSON.stringify(this.catalog)));for(const f of this.index.values())this.fallbackIndex.set(f.path,f)}await this.atomic(path.join(this.dir,'catalog.json'),b);this.catalog=c;this.index=new Map([...c.files,...(c.retained||[])].map(f=>[f.path,f]));this.status.checkedAt=Date.now();this.status.error=''}catch(e){this.status.error=e.message}finally{this.checking=null}return this.state()})();}
 async state(){await this.ready;return {...this.status,revision:this.catalog.revision,files:this.index.size,stale:this.stalePaths.size,dataRevision:this.catalog.dataRevision||this.catalog.revision,size:this.catalog.files.reduce((n,f)=>n+f.size,0),running:!!this.downloading};}
 async unpack(pack,signal){
  const bytes=await this.bytes(`https://github.com/TsuyuDX/eft-gps/releases/download/data-${this.catalog.revision.slice(0,16)}/${pack.name}`,pack.size,signal);
  if(bytes.length!==pack.size||digest(bytes)+'.gz'!==pack.name)throw Error('Повреждён архив материалов');
  const data=JSON.parse(gunzipSync(bytes,{maxOutputLength:48*1024*1024}));if(!Array.isArray(data.files)||data.files.length!==pack.files.length)throw Error('Invalid archive');
  const entries=[];const seen=new Set();for(const entry of data.files){const f=this.index.get(entry.path);if(!pack.files.includes(entry.path)||seen.has(entry.path)||typeof entry.data!=='string'||!f)throw Error('Unexpected archive entry');seen.add(entry.path);const b=Buffer.from(entry.data,'base64');if(b.length!==f.size||digest(b)!==f.sha256)throw Error('Archive checksum mismatch');if(f.path.endsWith('.json'))JSON.parse(b);entries.push([f,b])}
  for(const [f,b] of entries){signal.throwIfAborted();if(!await this.local(f))await this.atomic(this.cachePath(f),b);this.stalePaths.delete(f.path);this.status.done++;this.status.bytes+=f.size;this.status.current=f.path;}
 }
 start(){if(this.downloading||this.checking)return;this.controller=new AbortController();this.downloading=this.download(this.controller.signal).catch(e=>{this.status.phase=e.name==='AbortError'?'cancelled':'error';this.status.error=e.message;this.controller.abort()}).finally(()=>{this.downloading=null});}
 cancel(){this.controller?.abort()}
 async download(signal){await this.ready;this.status={...this.status,phase:'checking',done:0,total:0,bytes:0,totalBytes:0,error:''};const missing=new Set();for(const f of new Map([...this.index.values()].map(f=>[f.sha256,f])).values()){signal.throwIfAborted();if(!await this.local(f)){missing.add(f.path);this.status.total++;this.status.totalBytes+=f.size}}
  this.status.phase='downloading';const groups=[];for(const pack of this.catalog.packs){if(pack.files.every(f=>missing.has(f))){groups.push(pack);pack.files.forEach(f=>missing.delete(f))}}
  // Complete packs use a few large requests. Incremental refresh fetches ONLY
  // missing hashes, so cached files are never requested a second time.
  const jobs=[...groups.map(p=>({pack:p})),...[...missing].map(file=>({file}))];let cursor=0;
  await Promise.all(Array.from({length:2},async()=>{for(;;){signal.throwIfAborted();const job=jobs[cursor++];if(!job)return;if(job.pack){try{await this.unpack(job.pack,signal)}catch(e){if(signal.aborted)throw e;for(const p of job.pack.files){signal.throwIfAborted();const f=this.index.get(p);await this.file(p,signal);if(this.stalePaths.has(p))throw Error("Новая версия материала недоступна. Сохранённая копия доступна офлайн.");this.status.done++;this.status.bytes+=f.size;this.status.current=p}}}else{const f=this.index.get(job.file);await this.file(job.file,signal);if(this.stalePaths.has(job.file))throw Error("Новая версия материала недоступна. Сохранённая копия доступна офлайн.");this.status.done++;this.status.bytes+=f.size;this.status.current=job.file}}}));
  this.status.phase='complete';this.status.current='';
 }
}
