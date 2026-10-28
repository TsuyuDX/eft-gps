import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

export const UPDATE_REPO = 'TsuyuDX/eft-gps';
const MAX = 8 * 1024 ** 3;
export function newerVersion(candidate, current) {
  const parse = v => /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v) ? v.replace(/^v/,'').split('.').map(Number) : null;
  const a=parse(candidate), b=parse(current);
  if(!a || !b || [...a,...b].some(n=>!Number.isSafeInteger(n))) return false;
  for(let i=0;i<3;i++) if(a[i]!==b[i]) return a[i]>b[i];
  return false;
}
export function releaseAsset(release, name) {
  const asset=release.assets?.find(a=>a.name===name && a.state==='uploaded');
  const expected=`https://github.com/${UPDATE_REPO}/releases/download/${release.tag_name}/${name}`;
  if(!asset || asset.browser_download_url!==expected) throw Error('invalid-asset');
  return asset;
}
export function validateUpdate(manifest, release, current) {
  if(manifest?.format!==1 || manifest.app!=='EFTGPS' || release.draft || release.prerelease ||
    release.tag_name!==`v${manifest.version}` || !newerVersion(manifest.version,current) ||
    !Array.isArray(manifest.parts) || !manifest.parts.length || manifest.parts.length>16 ||
    !Number.isSafeInteger(manifest.size) || manifest.size<=0 || manifest.size>MAX ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw Error('invalid-manifest');
  let total=0;const names=new Set();
  for(const part of manifest.parts) {
    if(!/^EFTGPS-update-(?:from-[0-9.]+-)?[0-9.]+\.zip\.part\d{2}$/.test(part.name) || names.has(part.name) ||
       !Number.isSafeInteger(part.size) || part.size<=0 || !/^[a-f0-9]{64}$/.test(part.sha256)) throw Error('invalid-part');
    names.add(part.name);total+=part.size;
    if(releaseAsset(release,part.name).size!==part.size) throw Error('invalid-part-size');
  }
  if(total!==manifest.size) throw Error('invalid-total');
  return manifest;
}
export function selectUpdate(manifest,release,current) {
  const delta=manifest?.deltas?.find(d=>d.baseVersion===current);
  if(!delta) return validateUpdate(manifest,release,current);
  if(delta.baseVersion!==current || delta.size>=manifest.size) throw Error('invalid-delta');
  return {...validateUpdate({...delta,format:1,app:'EFTGPS',version:manifest.version},release,current),kind:'delta'};
}
async function request(url, fetcher, signal) {
  for(let redirects=0;redirects<6;redirects++) {
    const parsed=new URL(url);
    if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.port ||
       !['api.github.com','github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(parsed.hostname)) throw Error('invalid-download-host');
    const response=await fetcher(url,{redirect:'manual',signal,headers:{'User-Agent':'EFTGPS-Updater','Accept':parsed.hostname==='api.github.com'?'application/vnd.github+json':'application/octet-stream'}});
    if([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get('location');await response.body?.cancel();
      if(!location) throw Error('invalid-redirect');url=new URL(location,url).href;continue;
    }
    if(!response.ok) {await response.body?.cancel();throw Error(`http-${response.status}`);}
    return response;
  }
  throw Error('too-many-redirects');
}
async function readJSON(url,fetcher) {
  const response=await request(url,fetcher,AbortSignal.timeout(20000));
  const chunks=[];let size=0;
  for await(const chunk of response.body) {size+=chunk.length;if(size>1024*1024) throw Error('metadata-too-large');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export class AppUpdater {
  constructor(root,version,{fetcher=fetch,launch,temporary=os.tmpdir()}={}) {
    this.root=root;this.version=version;this.fetcher=fetcher;this.temporary=temporary;
    this.launch=launch || (async(exe,args)=>{
      const child=spawn(exe,args,{cwd:path.dirname(exe),detached:true,stdio:'ignore',windowsHide:false});
      child.once('exit',code=>{if(code===1223 && this.state.phase==='installer')this.state.phase='cancelled';});
      await once(child,'spawn');child.unref();
    });
    this.state={phase:'idle',percent:0,downloaded:0,total:0,file:'',version:''};
  }
  start() {return this.job ||= this.run();}
  async run() {
    let directory;
    try {
      this.state.phase='checking';
      // Exactly one release lookup per server lifetime, including concurrent UI reloads.
      const release=await readJSON(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,this.fetcher);
      if(release.draft || release.prerelease || !newerVersion(release.tag_name,this.version)) {this.state.phase='current';return;}
      const metadata=releaseAsset(release,'EFTGPS-update.json');
      const manifest=selectUpdate(await readJSON(metadata.browser_download_url,this.fetcher),release,this.version);
      directory=await fs.mkdtemp(path.join(this.temporary,'EFTGPS-update-'));
      const space=await fs.statfs(directory);
      if(space.bavail*space.bsize<manifest.size+256*1024**2) throw Error('disk-space');
      Object.assign(this.state,{phase:'downloading',version:manifest.version,total:manifest.size,kind:manifest.kind||'full'});
      const zip=path.join(directory,'update.zip');const whole=crypto.createHash('sha256');
      const output=await fs.open(zip,'wx');const abort=new AbortController();
      const offsets=[];let offset=0;for(const part of manifest.parts){offsets.push(offset);offset+=part.size;}
      let cursor=0;const started=Date.now();
      const download=async()=>{
        while(cursor<manifest.parts.length) {
          const index=cursor++,part=manifest.parts[index];let size=0;
          this.state.file=part.name;
          const response=await request(releaseAsset(release,part.name).browser_download_url,this.fetcher,AbortSignal.any([abort.signal,AbortSignal.timeout(30*60*1000)]));
          const hash=crypto.createHash('sha256');
          for await(const chunk of response.body) {
            if(size+chunk.length>part.size) throw Error('download-size');
            hash.update(chunk);if(manifest.parts.length===1)whole.update(chunk);
            let written=0;while(written<chunk.length){const result=await output.write(chunk,written,chunk.length-written,offsets[index]+size+written);if(!result.bytesWritten)throw Error('disk-write');written+=result.bytesWritten;}
            size+=chunk.length;this.state.downloaded+=chunk.length;
            this.state.percent=Math.min(99,Math.floor(this.state.downloaded/manifest.size*100));
            this.state.elapsedSeconds=Math.floor((Date.now()-started)/1000);
          }
          if(size!==part.size || hash.digest('hex')!==part.sha256) throw Error('checksum');
        }
      };
      const workers=Array.from({length:Math.min(3,manifest.parts.length)},()=>download().catch(error=>{abort.abort();throw error;}));
      try {
        const results=await Promise.allSettled(workers);const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
        this.state.phase='verifying';
      } finally {
        await output.close();
      }
      if(manifest.parts.length>1) for await(const chunk of createReadStream(zip))whole.update(chunk);
      if(whole.digest('hex')!==manifest.sha256) throw Error('checksum');
      // Run a copy outside the installation directory so the updater can replace itself.
      const helper=path.join(directory,'EFTGPS-Update.exe');
      await fs.copyFile(path.join(this.root,'runtime/TarkovMaintenance.exe'),helper);
      await this.launch(helper,['--update',this.root,zip,manifest.sha256,manifest.version]);
      Object.assign(this.state,{phase:'installer',percent:100,file:''});
    } catch(error) {
      this.state.phase='error';
      this.state.error=['checksum','disk-space','download-size'].includes(error.message)?error.message:'unavailable';
      if(directory) await fs.rm(directory,{recursive:true,force:true}).catch(()=>{});
    }
  }
}
