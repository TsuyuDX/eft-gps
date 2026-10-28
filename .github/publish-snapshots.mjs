import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {deltaManifest} from '../scripts/delta-manifest.mjs';
const home=path.dirname(fileURLToPath(import.meta.url)), workspace=path.dirname(home);
const repository='TsuyuDX/eft-gps',token=process.env.GH_TOKEN;
if(process.env.GITHUB_REPOSITORY!==repository || !token)throw Error('Run only in the authorized repository Actions environment.');
const temp=path.resolve(process.env.RUNNER_TEMP,'eft-gps-publication');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','User-Agent':'EFTGPS-release-workflow','X-GitHub-Api-Version':'2022-11-28'};
function run(command,args,cwd=workspace){const result=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:32*1024**2});if(result.status!==0)throw Error(`${path.basename(command)} failed: ${(result.stderr||result.error?.message||result.stdout).slice(-3000)}`);return result.stdout.trim();}
async function api(endpoint,{method='GET',body,missing=false}={}) {
  if(method!=='GET')await pause(1500);
  const response=await fetch(`https://api.github.com/repos/${repository}${endpoint}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  if(missing&&response.status===404)return null;
  const value=response.status===204?null:await response.json();
  if(!response.ok)throw Error(`GitHub ${response.status}: ${value?.message}. Stopped without repeated retries.`);
  return value;
}
async function hash(file,start,end){const h=crypto.createHash('sha256');for await(const chunk of createReadStream(file,{...(start===undefined?{}:{start,end})}))h.update(chunk);return h.digest('hex');}
async function descriptors(file,prefix) {
  const size=(await fs.stat(file)).size,parts=[],whole=crypto.createHash('sha256');let position=0,index=1;
  for(let start=0;start<size;start+=1024**3) {
    const end=Math.min(size,start+1024**3)-1,h=crypto.createHash('sha256');
    for await(const chunk of createReadStream(file,{start,end})){h.update(chunk);whole.update(chunk);position+=chunk.length;}
    parts.push({name:`${prefix}.part${String(index++).padStart(2,'0')}`,size:end-start+1,sha256:h.digest('hex'),file,start,end});
  }
  if(position!==size)throw Error('Incomplete package read');return {size,sha256:whole.digest('hex'),parts};
}
async function upload(release,asset,assets) {
  const existing=assets.find(a=>a.name===asset.name);
  if(existing){
    if(existing.state==='uploaded'&&existing.size===asset.size&&existing.digest===`sha256:${asset.sha256}`)return;
    if(!release.draft)throw Error('Published asset differs; refusing to overwrite '+asset.name);
    await api(`/releases/assets/${existing.id}`,{method:'DELETE'});assets.splice(assets.indexOf(existing),1);
  }
  await pause(1500);const url=new URL(release.upload_url.replace(/\{.*$/,''));url.searchParams.set('name',asset.name);
  if(url.hostname!=='uploads.github.com')throw Error('Unexpected upload host');
  console.log('Uploading',release.tag_name,asset.name,asset.size);
  const result=await new Promise((resolve,reject)=>{
    const request=https.request(url,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':asset.size}},response=>{
      let content='';response.setEncoding('utf8');response.on('data',x=>content+=x);response.on('end',()=>{
        let value;try{value=JSON.parse(content);}catch{return reject(Error('Invalid upload response'));}
        if(response.statusCode!==201)return reject(Error(`Upload ${response.statusCode}: ${value.message}`));resolve(value);
      });
    });
    request.setTimeout(20*60*1000,()=>request.destroy(Error('Upload timeout')));request.on('error',reject);
    const stream=createReadStream(asset.file,{...(asset.start===undefined?{}:{start:asset.start,end:asset.end})});stream.on('error',e=>request.destroy(e));stream.pipe(request);
  });
  if(result.size!==asset.size||result.digest!==`sha256:${asset.sha256}`)throw Error('Uploaded checksum differs: '+asset.name);
  assets.push(result);
}
async function smallAsset(file,name=path.basename(file)){return {name,file,size:(await fs.stat(file)).size,sha256:await hash(file)};}
const plan=JSON.parse(await fs.readFile(path.join(home,'release-plan.json'),'utf8'));
const latestVersion=plan.at(-1)?.version;
await fs.mkdir(temp,{recursive:true});run('git',['config','core.longpaths','true']);
for(const item of plan) {
  if(!/^\d+\.\d+\.\d+$/.test(item.version)||!/^\w{40}$/.test(item.commit))throw Error('Invalid fixed release plan');
  const deadline=Date.now()+60*60*1000;
  while(!await api(`/git/commits/${item.commit}`,{missing:true})) {
    if(Date.now()>deadline)throw Error('Historical source has not finished uploading: '+item.version);
    console.log('Waiting for verified source checkpoint',item.version);await pause(60000);
  }
  const prior=await api(`/releases/tags/${item.tag}`,{missing:true});
  if(prior&&!prior.draft){console.log('Already published; retaining existing release',item.tag);continue;}
  const source=path.join(temp,'source'),out=path.join(temp,'output');
  // Both generated directories have fixed names under this job's dedicated RUNNER_TEMP directory.
  for(const folder of [source,out]){if(!path.resolve(folder).startsWith(temp+path.sep))throw Error('Unsafe temporary path');await fs.rm(folder,{recursive:true,force:true});}
  run('git',['fetch','--no-tags','--depth=1','origin',item.commit]);
  run('git',['worktree','prune']);run('git',['worktree','add','--detach',source,item.commit]);await fs.mkdir(out);
  try {
    const componentModule=await import(pathToFileURL(path.join(source,'scripts/prepare-portable.mjs')).href+'?snapshot='+item.version);
    componentModule.assembleComponent(source,JSON.parse(await fs.readFile(path.join(source,'scripts/offline-components.json'),'utf8')));
    const inventoryFile=path.join(source,'distribution/package-files.json');const inventory=JSON.parse(await fs.readFile(inventoryFile,'utf8'));
    const files=inventory.files.map(f=>({...f}));
    for(const relative of ['distribution/package-files.json','runtime/MicrosoftEdgeWebView2RuntimeInstallerX64.exe']){
      if(!files.some(f=>f.path===relative)){const file=path.join(source,relative);files.push({path:relative,size:(await fs.stat(file)).size,sha256:await hash(file)});}
    }
    for(const entry of files){if(entry.path.split('/').some(p=>!p||p==='..'||p==='.')||/^(userdata|work|\.git)\//.test(entry.path))throw Error('Unsafe source inventory');}
    const releaseManifest={format:1,app:'TarkovOffline',version:item.version,builtAt:run('git',['show','-s','--format=%cI',item.commit]),files};
    const manifestFile=path.join(out,'release-input.json');await fs.writeFile(manifestFile,JSON.stringify(releaseManifest));
    const native=path.join(home,'native');
    const nativeText=path.join(out,'NativeText.cs'),translations=path.join(out,'native.en.json'),maintenance=path.join(out,'Maintenance.cs');
    await fs.writeFile(nativeText,(await fs.readFile(path.join(native,'NativeText.cs'),'utf8')).replace(/public const string Version="[^"]+"/,`public const string Version="${item.version}"`));
    await fs.writeFile(translations,(await fs.readFile(path.join(native,'native.en.json'),'utf8')).replaceAll('1.8.1',item.version));
    await fs.writeFile(maintenance,(await fs.readFile(path.join(native,'Maintenance.cs'),'utf8')).replaceAll('1.8.1',item.version));
    const compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
    const common=['/nologo','/target:winexe','/platform:x64','/reference:System.Windows.Forms.dll','/reference:System.Web.Extensions.dll','/reference:System.Drawing.dll','/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll',`/win32icon:${path.join(native,'app.ico')}`,`/resource:${path.join(native,'app-192.png')},installer-logo.png`,`/resource:${translations},native.en.json`];
    const stub=path.join(out,'UpdateSetup.exe');run(compiler,[...common,`/out:${stub}`,nativeText,maintenance]);
    const packager=path.join(out,'PackRelease.exe');run(compiler,['/nologo','/target:exe','/reference:System.Web.Extensions.dll','/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll',`/out:${packager}`,path.join(native,'PackRelease.cs')]);
    const portable=path.join(out,`TSUYU-EFTGPS-${item.version}-Windows.zip`),setup=path.join(out,`TSUYU-EFTGPS-${item.version}-Setup.exe`);
    console.log('Packing verified snapshot',item.version,files.length,'files');run(packager,[source,manifestFile,portable,setup,stub]);
    const setupInfo=await descriptors(setup,path.basename(setup)),zipInfo=await descriptors(portable,`EFTGPS-update-${item.version}.zip`);
    const deltaAssets=[],deltas=[];
    for(const baseVersion of item.deltaBases||[]) {
      const base=plan.find(p=>p.version===baseVersion);if(!base)throw Error('Unknown delta base');
      run('git',['fetch','--no-tags','--depth=1','origin',base.commit]);
      const baseInventory=JSON.parse(run('git',['show',`${base.commit}:distribution/package-files.json`]));
      const component=JSON.parse(run('git',['show',`${base.commit}:scripts/offline-components.json`]));
      const inventoryBytes=Buffer.from(run('git',['show',`${base.commit}:distribution/package-files.json`])+'\n');
      // Git inventories exclude themselves and the assembled Microsoft runtime.
      const baseFiles=[...baseInventory.files,{path:'distribution/package-files.json',size:inventoryBytes.length,sha256:crypto.createHash('sha256').update(inventoryBytes).digest('hex')},{path:'runtime/'+component.output,size:component.size,sha256:component.sha256}];
      const delta=deltaManifest(releaseManifest,{app:'TarkovOffline',version:baseVersion,files:baseFiles});
      const input=path.join(out,`delta-${baseVersion}.json`),zip=path.join(out,`delta-${baseVersion}.zip`);
      await fs.writeFile(input,JSON.stringify(delta));run(packager,[source,input,zip,'-']);
      const info=await descriptors(zip,`EFTGPS-update-from-${baseVersion}-${item.version}.zip`);
      deltaAssets.push(...info.parts);deltas.push({baseVersion,size:info.size,sha256:info.sha256,parts:info.parts.map(({name,size,sha256})=>({name,size,sha256}))});
      console.log('Delta',baseVersion,'to',item.version,delta.files.length,'files',info.size,'bytes');
    }
    const strip=parts=>parts.map(({name,size,sha256})=>({name,size,sha256}));
    const setupManifest=path.join(out,'setup-parts.json'),updateManifest=path.join(out,'EFTGPS-update.json');
    await fs.writeFile(setupManifest,JSON.stringify({format:1,version:item.version,output:path.basename(setup),size:setupInfo.size,sha256:setupInfo.sha256,parts:strip(setupInfo.parts)},null,2));
    await fs.writeFile(updateManifest,JSON.stringify({format:1,app:'EFTGPS',version:item.version,size:zipInfo.size,sha256:zipInfo.sha256,parts:strip(zipInfo.parts),deltas},null,2));
    const tagSource=path.join(out,'DownloadRelease.cs');await fs.writeFile(tagSource,`public static class DownloadRelease { public const string Tag="${item.tag}"; }`);
    const downloader=path.join(out,'EFT-GPS-Setup.exe');run(compiler,[...common,'/main:DownloadSetup',`/out:${downloader}`,`/resource:${setupManifest},setup-parts.json`,nativeText,maintenance,path.join(native,'DownloadSetup.cs'),tagSource]);run(downloader,['--self-test']);
    const instructions=path.join(out,'INSTALL.txt');await fs.writeFile(instructions,`T_S_U_Y_U EFT GPS ${item.version}\n\nRU: Скачайте EFT-GPS-Setup.exe и нажмите «Скачать и установить». Загрузчик проверит пакет и откроет установщик. При обновлении выберите текущую папку, чтобы сохранить прогресс.\nEN: Download EFT-GPS-Setup.exe and click Download and install. The downloader verifies and opens setup. Select your existing folder to keep progress.\n\nThis release is rebuilt from the verified saved application snapshot ${item.commit}. Original local archives remain unchanged. Source snapshot: ${item.tag}.\n\nFor a portable ZIP, combine the EFTGPS-update-*.zip.partNN files in numerical order and verify the resulting ZIP against EFTGPS-update.json. Extract fully and run Start EFT GPS.cmd.\n`);
    const checksums=path.join(out,'SHA256SUMS.txt');await fs.writeFile(checksums,[...setupInfo.parts,...zipInfo.parts].map(p=>`${p.sha256}  ${p.name}`).concat([`${setupInfo.sha256}  ${path.basename(setup)}`,`${zipInfo.sha256}  ${path.basename(portable)}`,`${await hash(downloader)}  EFT-GPS-Setup.exe`]).join('\n')+'\n');
    const body=`## T_S_U_Y_U EFT GPS ${item.version}\n\n**[Download and install / Скачать и установить](https://github.com/${repository}/releases/download/${item.tag}/EFT-GPS-Setup.exe)**\n\nWindows 10 (1903+) / 11 x64. Maps and reference data work offline.\n\nRebuilt from the verified saved application snapshot \`${item.commit}\`. This is a runnable historical snapshot; original local archives were retained unchanged. Every download part is SHA-256 verified.\n\nВосстановленная сборка из сохранённого снимка приложения. Скачайте один файл **EFT-GPS-Setup.exe**, откройте и нажмите «Скачать и установить». При обновлении выберите текущую папку программы.\n\nPortable package: download all EFTGPS-update ZIP parts and EFTGPS-update.json; combine in numerical order, verify SHA-256, extract fully, then run **Start EFT GPS.cmd**.\n\n${item.version===latestVersion?'Automatic update checks, a bottom download progress indicator, an update mode preserving the current folder, and separate Boosty donation / membership links. Early access: bugs may occur.\n\nПроверка обновлений при запуске, прогресс загрузки внизу окна, обновление текущей папки с сохранением данных, разовый донат и подписка Boosty. Ранний доступ: возможны ошибки.':'Archived version. For current functionality choose the latest stable release.'}\n\n[Support the free project](https://boosty.to/tsuyueftgps) · Discord coming soon.`;
    const release=prior||await api('/releases',{method:'POST',body:{tag_name:item.tag,target_commitish:item.commit,name:`T_S_U_Y_U EFT GPS ${item.version}`,body,draft:true,prerelease:false,make_latest:'false'}});
    const assets=await api(`/releases/${release.id}/assets?per_page=100`);
    for(const file of [downloader,setupManifest,updateManifest,instructions,checksums])await upload(release,await smallAsset(file),assets);
    for(const part of [...setupInfo.parts,...zipInfo.parts,...deltaAssets])await upload(release,part,assets);
    await api(`/releases/${release.id}`,{method:'PATCH',body:{body,draft:false,make_latest:item.version===latestVersion?'true':'false'}});
    console.log('Published and verified',item.tag,release.html_url);
  } finally {run('git',['worktree','remove','--force',source]);await fs.rm(out,{recursive:true,force:true});}
}
console.log('All saved versions published.');
