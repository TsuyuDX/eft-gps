import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { AppUpdater, newerVersion, validateUpdate, selectUpdate, UPDATE_REPO } from '../server/app-update.mjs';
import {deltaManifest} from '../scripts/delta-manifest.mjs';
import { buildAppUpdate } from '../scripts/build-app-update.mjs';
import { parseHTML } from 'linkedom';
import { setLanguage } from '../public/core/localization.js';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fixture(t) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'EFTGPS-updater-test-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const root=path.join(directory,'installed app');await fs.mkdir(path.join(root,'runtime'),{recursive:true});
  await fs.writeFile(path.join(root,'runtime/TarkovMaintenance.exe'),'test helper');
  const bytes=Buffer.from('multipart update payload');
  const zip=path.join(directory,'fixture.zip');await fs.writeFile(zip,bytes);
  const output=path.join(directory,'assets');const manifest=await buildAppUpdate(zip,output,'1.8.0',7);
  const base=`https://github.com/${UPDATE_REPO}/releases/download/v1.8.0/`;
  const release={tag_name:'v1.8.0',draft:false,prerelease:false,assets:[{name:'EFTGPS-update.json',state:'uploaded',browser_download_url:base+'EFTGPS-update.json'},...manifest.parts.map(part=>({...part,state:'uploaded',browser_download_url:base+part.name}))]};
  let checks=0;const launches=[];
  const fetcher=async url=>{
    if(url.endsWith('/releases/latest')) {checks++;return Response.json(release);}
    if(url===base+'EFTGPS-update.json') return Response.json(manifest);
    return new Response(await fs.readFile(path.join(output,new URL(url).pathname.split('/').at(-1))));
  };
  const launch=async(exe,args)=>{launches.push({exe,args,bytes:await fs.readFile(args[2])});};
  return {root,directory,bytes,output,manifest,release,fetcher,launch,launches,checks:()=>checks};
}
test('semantic version comparison excludes old versions, prereleases and malformed versions',()=>{
  assert.equal(newerVersion('v1.10.0','1.9.0'),true);
  for(const v of ['v1.7.0','1.6.9','1.8.0-beta','1.07.1','../../2.0.0']) assert.equal(newerVersion(v,'1.7.0'),false);
});
test('concurrent startup checks download verified parts once and launch update mode in the original folder',async t=>{
  const f=await fixture(t);const updater=new AppUpdater(f.root,'1.7.0',{...f,temporary:f.directory});
  const first=updater.start();assert.equal(first,updater.start());await first;await updater.start();
  assert.equal(f.checks(),1);assert.equal(updater.state.phase,'installer');assert.equal(updater.state.percent,100);
  assert.equal(f.launches.length,1);const {exe,args,bytes}=f.launches[0];
  assert.equal(args[0],'--update');assert.equal(args[1],f.root);assert.equal(args[3],hash(f.bytes));assert.equal(args[4],'1.8.0');
  assert.deepEqual(bytes,f.bytes);assert.equal(exe.startsWith(f.root+path.sep),false);
});
test('tampered download never opens the installer and partial files are removed',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.output,f.manifest.parts[0].name),'corrupt');
  const updater=new AppUpdater(f.root,'1.7.0',{...f,temporary:f.directory});await updater.start();
  assert.equal(updater.state.phase,'error');assert.equal(updater.state.error,'checksum');assert.equal(f.launches.length,0);
  assert.deepEqual((await fs.readdir(f.directory)).filter(n=>n.startsWith('EFTGPS-update-')),[]);
});
test('offline and unavailable repositories do not retry or modify application files',async t=>{
  const f=await fixture(t);let requests=0;
  const updater=new AppUpdater(f.root,'1.7.0',{temporary:f.directory,fetcher:async()=>{requests++;throw Error('offline');},launch:f.launch});
  await updater.start();await updater.start();assert.equal(requests,1);assert.equal(updater.state.error,'unavailable');
  assert.equal(await fs.readFile(path.join(f.root,'runtime/TarkovMaintenance.exe'),'utf8'),'test helper');
});
test('current release needs only one lookup and no downloads',async t=>{
  const f=await fixture(t);const updater=new AppUpdater(f.root,'1.8.0',{...f,temporary:f.directory});await updater.start();
  assert.equal(updater.state.phase,'current');assert.equal(f.checks(),1);assert.equal(f.launches.length,0);
});
test('delta contains only changed files and removals and selects an exact installed base',async t=>{
  const f=await fixture(t);
  const base={app:'TarkovOffline',version:'1.7.0',files:[{path:'package.json',size:1,sha256:'a'},{path:'map.svg',size:50,sha256:'same'},{path:'old.txt',size:1,sha256:'b'}]};
  const current={...base,version:'1.8.0',files:[{path:'package.json',size:1,sha256:'new'},base.files[1]]};
  const delta=deltaManifest(current,base);assert.deepEqual(delta.files.map(f=>f.path),['package.json']);assert.deepEqual(delta.removed,['old.txt']);
  const manifest={...f.manifest,size:f.manifest.size+100,deltas:[{baseVersion:'1.7.0',...f.manifest}]};
  assert.equal(selectUpdate(manifest,f.release,'1.7.0').kind,'delta');
  assert.throws(()=>selectUpdate({...manifest,deltas:[{...manifest.deltas[0],sha256:'bad'}]},f.release,'1.7.0'));
  assert.equal(selectUpdate(f.manifest,f.release,'1.7.0').kind,undefined);
});
test('multipart download uses bounded concurrency and preserves part order',async t=>{
  const f=await fixture(t);let active=0,max=0;
  const fetcher=async(url,options)=>{
    if(url.endsWith('/releases/latest')||url.endsWith('.json'))return f.fetcher(url,options);
    active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,10));
    const response=await f.fetcher(url,options);active--;return response;
  };
  const updater=new AppUpdater(f.root,'1.7.0',{...f,fetcher,temporary:f.directory});await updater.start();
  assert.equal(updater.state.phase,'installer');assert.equal(max,3);assert.deepEqual(f.launches[0].bytes,f.bytes);
});
test('rejects mismatched versions, malicious paths, outside assets, duplicate parts and invalid total sizes',async t=>{
  const f=await fixture(t);
  for(const mutate of [
    m=>m.parts[0].name='../evil.exe', m=>m.version='2.0.0', m=>m.size++, m=>m.sha256='bad',m=>m.parts.push(m.parts[0]),
  ]) {const m=structuredClone(f.manifest);mutate(m);assert.throws(()=>validateUpdate(m,f.release,'1.7.0'));}
  const r=structuredClone(f.release);r.assets[1].browser_download_url='https://evil.test/payload';assert.throws(()=>validateUpdate(f.manifest,r,'1.7.0'));
});
test('download redirects cannot leave trusted GitHub hosts',async t=>{
  const f=await fixture(t);let calls=0;
  const updater=new AppUpdater(f.root,'1.7.0',{temporary:f.directory,launch:f.launch,fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://evil.test/payload'}});}});
  await updater.start();assert.equal(calls,1);assert.equal(updater.state.phase,'error');assert.equal(f.launches.length,0);
});
test('bottom progress UI shows filename, percentage and translated status, and starts only once',async()=>{
  const {document,window}=parseHTML('<html><body></body></html>');
  Object.assign(globalThis,{document,window,Event:window.Event});globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  setLanguage('en',{persist:false});const originalFetch=globalThis.fetch,originalTimeout=globalThis.setTimeout;
  const requests=[];let next;
  globalThis.fetch=async(url,options)=>{requests.push([url,options]);return Response.json(url.endsWith('/start')?{}:{phase:'downloading',version:'1.8.0',file:'part01',percent:42,downloaded:42,total:100});};
  globalThis.setTimeout=callback=>{next=callback;};
  try {
    const {startAppUpdates}=await import('../public/core/app-update.js');startAppUpdates();startAppUpdates();
    for(let i=0;i<10;i++)await Promise.resolve();
    assert.equal(requests.filter(([url])=>url.endsWith('/start')).length,1);
    assert.match(document.querySelector('.app-update-copy').textContent,/Downloading update.*42%.*part01/);
    assert.equal(document.querySelector('progress').value,42);assert.equal(typeof next,'function');
    document.querySelector('button').onclick();assert.equal(document.querySelector('aside').hidden,true);
  } finally {globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimeout;}
});


test('a missing setup helper preserves the verified download at 100 percent and reports the installation failure',async t=>{
  const f=await fixture(t);await fs.unlink(path.join(f.root,'runtime/TarkovMaintenance.exe'));
  const updater=new AppUpdater(f.root,'1.7.0',{...f,temporary:f.directory});await updater.start();
  assert.equal(updater.state.phase,'error');assert.equal(updater.state.error,'installer-missing');
  assert.equal(updater.state.percent,100);assert.equal(updater.state.packageVerified,true);assert.equal(updater.state.packageSaved,true);
  assert.equal(updater.state.downloaded,updater.state.total);assert.equal(f.launches.length,0);
  const names=(await fs.readdir(f.directory)).filter(n=>n.startsWith('EFTGPS-update-'));
  assert.equal(names.length,1);assert.deepEqual(await fs.readFile(path.join(f.directory,names[0],'update.zip')),f.bytes);
});

test('a denied setup launch preserves the verified package without retrying or restoring the helper',async t=>{
  const f=await fixture(t);let attempts=0;
  const updater=new AppUpdater(f.root,'1.7.0',{...f,temporary:f.directory,launch:async()=>{attempts++;throw Object.assign(Error('Denied'),{code:'EACCES'});}});
  await updater.start();await updater.start();
  assert.equal(attempts,1);assert.equal(updater.state.error,'installer-access');assert.equal(updater.state.packageSaved,true);
  assert.equal(await fs.readFile(path.join(f.root,'runtime/TarkovMaintenance.exe'),'utf8'),'test helper');
});
