import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { assembleComponent, verifyPackage } from '../scripts/prepare-portable.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'eft-portable-'));
  fs.mkdirSync(path.join(root,'distribution','components'),{recursive:true});
  const chunks=[Buffer.from('offline-'),Buffer.from('component')],whole=Buffer.concat(chunks);
  const parts=chunks.map((data,i)=>{
    const name='webview-'+i+'.bin'; fs.writeFileSync(path.join(root,'distribution','components',name),data);
    return {name,size:data.length,sha256:hash(data)};
  });
  return {root,manifest:{format:1,output:'Component.exe',size:whole.length,sha256:hash(whole),parts},whole};
}
test('portable component assembles offline, verifies bytes and reuses a verified installer',()=>{
  const {root,manifest,whole}=fixture();
  try { const output=assembleComponent(root,manifest);assert.deepEqual(fs.readFileSync(output),whole);assert.equal(assembleComponent(root,manifest),output); }
  finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('portable preparation rejects damaged/missing parts, traversal, duplicates and a different existing installer',()=>{
  const {root,manifest}=fixture();
  try {
    assert.throws(()=>assembleComponent(root,{...manifest,output:'../bad.exe'}),/manifest/);
    assert.throws(()=>assembleComponent(root,{...manifest,parts:[{...manifest.parts[0],name:'../bad.bin'}]}),/part/);
    assert.throws(()=>assembleComponent(root,{...manifest,parts:[manifest.parts[0],manifest.parts[0]],size:manifest.parts[0].size*2}),/duplicate/);
    const part=path.join(root,'distribution','components',manifest.parts[1].name);
    fs.writeFileSync(part,Buffer.alloc(manifest.parts[1].size));
    assert.throws(()=>assembleComponent(root,manifest),/damaged/);
    fs.unlinkSync(part);assert.throws(()=>assembleComponent(root,manifest),/damaged/);
    assert.deepEqual(fs.readdirSync(path.join(root,'runtime')),[]);
    fs.writeFileSync(path.join(root,'runtime',manifest.output),'other');
    assert.throws(()=>assembleComponent(root,manifest),/damaged/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('Git package inventory catches missing and modified files and refuses paths outside the checkout',()=>{
  const {root}=fixture();
  try {
    const file=path.join(root,'file.txt'),bytes=Buffer.from('original');fs.writeFileSync(file,bytes);
    const write=entry=>fs.writeFileSync(path.join(root,'distribution','package-files.json'),JSON.stringify({format:1,files:[entry]}));
    const entry={path:'file.txt',size:bytes.length,sha256:hash(bytes)};write(entry);assert.equal(verifyPackage(root),1);
    fs.writeFileSync(file,'changed!');assert.throws(()=>verifyPackage(root),/damaged/);
    fs.unlinkSync(file);assert.throws(()=>verifyPackage(root),/damaged/);
    write({...entry,path:'../file.txt'});assert.throws(()=>verifyPackage(root),/path/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
