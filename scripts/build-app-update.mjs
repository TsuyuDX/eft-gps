import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export async function buildAppUpdate(zip,output,version,partSize=1024**3) {
  if(!/^\d+\.\d+\.\d+$/.test(version) || !Number.isSafeInteger(partSize) || partSize<1) throw Error('Invalid update arguments');
  await fs.mkdir(output,{recursive:true});
  const whole=crypto.createHash('sha256');const parts=[];let handle,hash,size=0,total=0,name;
  try {
    for await(const chunk of createReadStream(zip)) {
      let offset=0;
      while(offset<chunk.length) {
        if(!handle) {name=`EFTGPS-update-${version}.zip.part${String(parts.length+1).padStart(2,'0')}`;handle=await fs.open(path.join(output,name),'wx');hash=crypto.createHash('sha256');size=0;}
        const piece=chunk.subarray(offset,offset+Math.min(partSize-size,chunk.length-offset));
        await handle.writeFile(piece);hash.update(piece);whole.update(piece);size+=piece.length;total+=piece.length;offset+=piece.length;
        if(size===partSize) {await handle.close();handle=null;parts.push({name,size,sha256:hash.digest('hex')});}
      }
    }
    if(handle) {await handle.close();handle=null;parts.push({name,size,sha256:hash.digest('hex')});}
    if(!total || parts.length>16) throw Error('Invalid update package size');
    const manifest={format:1,app:'EFTGPS',version,size:total,sha256:whole.digest('hex'),parts};
    await fs.writeFile(path.join(output,'EFTGPS-update.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    return manifest;
  } finally {await handle?.close();}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [zip,output,version]=process.argv.slice(2);
  console.log(JSON.stringify(await buildAppUpdate(zip,output,version)));
}
