import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {discoverGamePaths,startupDiagnostics} from '../server/startup.mjs';
test('startup discovers bounded conventional paths and preserves an existing custom screenshot folder',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tarkov-startup-'));
 try{
  const custom=path.join(root,'custom'),standard=path.join(root,'Documents','Escape from Tarkov','Screenshots');
  const steam=path.join(root,'Programs','Steam'),library=path.join(root,'Library'),logs=path.join(library,'steamapps','common','Escape from Tarkov','build','Logs');
  await Promise.all([custom,standard,logs,path.join(steam,'steamapps')].map(p=>fs.mkdir(p,{recursive:true})));
  await fs.writeFile(path.join(steam,'steamapps','libraryfolders.vdf'),`"path" "${library.replaceAll('\\','\\\\')}"`);
  const options={home:root,env:{'ProgramFiles(x86)':path.join(root,'Programs')}};
  assert.deepEqual(await discoverGamePaths({screenshotsPath:custom},options),{screenshotsPath:custom,logsPath:logs});
  assert.equal((await discoverGamePaths({screenshotsPath:path.join(root,'missing')},options)).screenshotsPath,standard);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('startup diagnoses critical data failures, treats missing GPS paths as optional and removes its own probe',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tarkov-startup-'));
 try{
  await fs.mkdir(path.join(root,'public/data/regular'),{recursive:true});await fs.mkdir(path.join(root,'userdata'),{recursive:true});
  await fs.writeFile(path.join(root,'userdata/profile.json'),'personal progress');
  await fs.writeFile(path.join(root,'public/data/manifest.json'),'{}');
  await fs.writeFile(path.join(root,'public/data/maps.json'),'[{"name":"Test"}]');
  await fs.writeFile(path.join(root,'public/data/regular/items.json'),'[{"id":"test"}]');
  const options={home:root,env:{}};
  const result=await startupDiagnostics(root,{},options);assert.equal(result.ready,true);
  assert.ok(result.checks.some(c=>c.id==='screenshots'&&c.state==='warning'));
  assert.ok(result.checks.every(c=>c.label));
  assert.deepEqual(await fs.readdir(path.join(root,'userdata')),['profile.json']);
  assert.equal(await fs.readFile(path.join(root,'userdata/profile.json'),'utf8'),'personal progress');
  await fs.writeFile(path.join(root,'public/data/maps.json'),'broken');
  assert.equal((await startupDiagnostics(root,{},options)).ready,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
