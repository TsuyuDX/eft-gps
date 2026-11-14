// Maintainer command: use the existing bounded/sanitized updater to create an offline snapshot.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {EventContentService} from "../server/event-content.mjs";
const root=path.resolve(import.meta.dirname,".."),temporary=path.join(root,"work/event-snapshot");
await fs.mkdir(path.join(temporary,"public/data"),{recursive:true});
await fs.copyFile(path.join(root,"public/data/assets.json"),path.join(temporary,"public/data/assets.json"));
const service=new EventContentService(temporary);
const result=await service.check({force:true});
if(result.state.phase!=="current"||!result.data)throw Error("Event source unavailable; existing snapshot retained.");
const bundle=result.data,assets=JSON.parse(await fs.readFile(path.join(root,"public/data/assets.json"),"utf8"));
await fs.mkdir(path.join(root,"public/assets/event-guides"),{recursive:true});
const substitutions=new Map();
for(const [url,local] of Object.entries(bundle.media)){
  if(!local.startsWith("/assets/live-event/"))continue;
  const target="/assets/event-guides/"+path.basename(local);
  await fs.copyFile(path.join(temporary,"userdata/event-content/assets",path.basename(local)),path.join(root,"public",target));
  substitutions.set(local,target);assets[url]=target;bundle.media[url]=target;
}
function localize(value){
  if(typeof value==="string")return substitutions.get(value)||value;
  if(Array.isArray(value))return value.map(localize);
  if(value&&typeof value==="object")for(const key of Object.keys(value))value[key]=localize(value[key]);
  return value;
}
localize(bundle.quests);
for(const locale of ["ru","en"])for(const [slug,q] of Object.entries(bundle.quests[locale])){
  q.liveSource=`https://www.tarkovhead.com/${locale}/quest/regular/${slug}`;
  q.checkedAt=bundle.checkedAt;
}
bundle.revision=crypto.createHash("sha256").update(JSON.stringify(bundle.quests)).digest("hex");
// Data is installed only after the complete bilingual snapshot and its media succeeded.
await fs.writeFile(path.join(root,"public/data/event-content.json"),JSON.stringify(bundle));
await fs.writeFile(path.join(root,"public/data/assets.json"),JSON.stringify(assets));
console.log(JSON.stringify({checkedAt:bundle.checkedAt,ru:Object.keys(bundle.quests.ru).length,en:Object.keys(bundle.quests.en).length,images:substitutions.size}));
