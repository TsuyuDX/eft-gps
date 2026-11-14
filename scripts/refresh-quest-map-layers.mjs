// Refresh event quest points only; preserve drawings, hazards and every other local category.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {allowedEventMedia} from "../server/event-content.mjs";
import {canonicalQuestLayer} from "../public/core/map-data-quality.js";
const root=path.resolve(import.meta.dirname,".."),base=path.join(root,"public/data");
const read=async relative=>JSON.parse(await fs.readFile(path.join(base,relative),"utf8"));
const snapshot=await read("event-content.json"),maps=await read("maps.json"),assets=await read("assets.json");
const pending=[],media=new Map();let duplicates=0,mediaBytes=0;
async function ensureImage(url){
  if(assets[url])return;
  assets[url] ||= assets[url.split("?")[0]];
  if(assets[url])return;
  if(!allowedEventMedia(url))throw Error("Unapproved point image source");
  const response=await fetch(new URL(url,"https://www.tarkovhead.com"),{signal:AbortSignal.timeout(15000),redirect:"error"});
  if(!response.ok)throw Error("Point image unavailable: "+url);
  const chunks=[];let size=0;
  for await(const chunk of response.body){if((size+=chunk.length)>4*1024**2)throw Error("Point image too large");chunks.push(chunk);}
  const bytes=Buffer.concat(chunks),ext=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"png":bytes[0]===255&&bytes[1]===216?"jpg":bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"?"webp":null;
  if(!ext || media.size>=64 || (mediaBytes+=bytes.length)>40*1024**2)throw Error("Invalid point image or media budget exceeded");
  const target="/assets/event-guides/"+crypto.createHash("sha256").update(url).digest("hex")+"."+ext;
  media.set(target,bytes);assets[url]=target;
}
for(const locale of ["ru","en"])for(const mode of ["regular","pve"])for(const map of maps){
  const slug=map.routeSlug||map.normalizedName;
  const file=(locale==="en"?"en/":"")+(mode==="pve"?"pve/":"")+"maps/"+slug+".json";
  const local=await read(file);
  const response=await fetch(`https://www.tarkovhead.com/api/map/${slug}?gameMode=${mode}&locale=${locale}`,{signal:AbortSignal.timeout(15000),redirect:"error"});
  if(!response.ok)throw Error("Map source unavailable: "+file);
  const {map:remote}=await response.json();if(!remote||!Array.isArray(remote.questLayers))throw Error("Invalid map source: "+file);
  const fresh=new Map();
  for(const rawLayer of remote.questLayers.filter(q=>q.questData?.normalizedName?.startsWith("halloween-"))){
    const layer=canonicalQuestLayer(rawLayer),quest=layer.questData.normalizedName;
    if(!snapshot.quests[locale][quest])throw Error("Missing offline quest: "+quest);
    duplicates+=(rawLayer.objectiveMarkers?.length||0)-(layer.objectiveMarkers?.length||0);
    for(const marker of [...layer.itemMarkers||[],...layer.objectiveMarkers||[]]){
      if(!Number.isFinite(marker.position?.x)||!Number.isFinite(marker.position?.z))throw Error("Invalid quest point: "+quest);
      for(const image of marker.pointImages||[]){
        // A preset changes delivery size, not the illustrated object.
        await ensureImage(image);
      }
    }
    fresh.set(quest,layer);
  }
  const layers=[];
  for(const layer of local.map.questLayers||[]){
    const slug=layer.questData?.normalizedName;
    if(slug?.startsWith("halloween-") && fresh.has(slug)){layers.push(fresh.get(slug));fresh.delete(slug);}
    else layers.push(layer);
  }
  layers.push(...fresh.values());local.map.questLayers=layers;
  pending.push({file,data:local});
}
// An interrupted source check never leaves a half-refreshed set of map files.
await fs.mkdir(path.join(root,"public/assets/event-guides"),{recursive:true});
for(const [target,bytes] of media)await fs.writeFile(path.join(root,"public",target),bytes);
for(const {file,data} of pending)await fs.writeFile(path.join(base,file),JSON.stringify(data));
await fs.writeFile(path.join(base,"assets.json"),JSON.stringify(assets));
console.log(JSON.stringify({maps:pending.length,removedLegacyCopies:duplicates,images:media.size,checkedAt:new Date().toISOString()}));
