import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProfileStore } from "../server/profile-store.mjs";
import { fixAgeLabel } from "../public/core/gps-format.js";
import { sanitizeGameInfo } from "../public/core/game-info-model.js";
import { buildSearchIndex, searchEntries } from "../public/core/global-search.js";
import { dedupeNews } from "../public/features/news.js";
import {canonicalQuestLayer} from "../public/core/map-data-quality.js";

const mode = () => ({quests:{},objectives:{},inventory:{},hideout:{},pins:{},favorites:[],modifiers:[],notes:""});
const profile = () => ({version:1,mode:"regular",modes:{regular:mode(),pve:mode()}});
async function storeFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "EFTGPS-profile-test-"));
  t.after(() => fs.rm(directory,{recursive:true,force:true}));
  return new ProfileStore(path.join(directory,"userdata"));
}

test("disk profile recovers its last valid backup and never replaces it with corrupt JSON", async t => {
  const store = await storeFixture(t), first = profile(), second = profile();
  first.modes.regular.notes = "first";
  second.modes.regular.notes = "second";
  assert.equal(store.read(), null);
  store.write(first);
  store.write(second);
  assert.equal(store.read().modes.regular.notes, "second");
  await fs.writeFile(store.file, "{broken");
  assert.equal(store.read().modes.regular.notes, "first");
  assert.equal(store.recovered, true);
  store.write(second);
  assert.equal(JSON.parse(await fs.readFile(store.file+".bak","utf8")).modes.regular.notes,"first");
  assert.deepEqual(store.read(), second);
  assert.deepEqual((await fs.readdir(store.directory)).sort(),["profile.json","profile.json.bak"]);
});

test("unrecoverable profiles and redirected directories are preserved instead of being overwritten", async t => {
  const store = await storeFixture(t);
  await fs.mkdir(store.directory);
  await fs.writeFile(store.file,"{unrecoverable");
  assert.throws(() => store.write(profile()));
  assert.equal(await fs.readFile(store.file,"utf8"),"{unrecoverable");
  await fs.rm(store.file);
  const outside=path.join(path.dirname(store.directory),"outside");
  await fs.mkdir(outside);
  await fs.rmdir(store.directory);
  await fs.symlink(outside,store.directory,process.platform==="win32"?"junction":"dir");
  assert.throws(()=>store.write(profile()),/unsafe-profile-directory/);
  assert.deepEqual(await fs.readdir(outside),[]);
});

test("blocked browser storage still saves progress and settings through the local API", async t => {
  const previous={localStorage:globalThis.localStorage,window:globalThis.window,fetch:globalThis.fetch};
  t.after(()=>Object.assign(globalThis,previous));
  globalThis.localStorage={getItem(){throw Error("blocked");},setItem(){throw Error("quota");},get length(){throw Error("blocked");}};
  globalThis.window=new EventTarget();
  const writes=[];
  globalThis.fetch=async(url,options)=>{if(options)writes.push({url,body:JSON.parse(options.body)});return Response.json(options?{}:null);};
  const state=await import("../public/core/state.js?storage-failure");
  await state.loadState();
  state.inventory("test-item",Infinity);
  state.setHideout("medstation",-10);
  const settings=await import("../public/core/window-settings.js");
  settings.writeWindowSetting("tarkov-overlay-v1",JSON.stringify({enabled:true}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(writes.some(x=>x.url==="/api/profile"&&x.body.modes.regular.inventory["test-item"]===0));
  assert.ok(writes.some(x=>x.url==="/api/window-settings"&&JSON.parse(x.body.values["tarkov-overlay-v1"]).enabled));
  assert.equal(state.current().hideout.medstation,0);
  assert.throws(()=>state.setMode("invalid"),/Invalid mode/);
});

test("the latest mode request wins even when an older data load finishes last", async t => {
  const previous=globalThis.fetch;
  t.after(()=>{globalThis.fetch=previous;});
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  globalThis.fetch=async url=>{
    if(url.includes("regular/"))await gate;
    return Response.json(url.includes("items.json")?[{name:url}]:url.includes("quests.json")?[]:{source:url});
  };
  const data=await import("../public/core/data.js?mode-race");
  const old=data.loadMode("regular","ru");
  assert.equal(await data.loadMode("pve","ru"),true);
  release();
  assert.equal(await old,false);
  assert.equal(data.db.mode,"pve");
  assert.ok(data.db.items[0].name.includes("pve/"));
  assert.ok(data.db.tracker.source.includes("pve/"));
});

test("obsolete item loads cannot overwrite a newer view after navigation",async t=>{
  const previous=globalThis.fetch;t.after(()=>{globalThis.fetch=previous;});
  let respond,started;const request=new Promise(resolve=>{started=resolve;});
  globalThis.fetch=async()=>{started();return new Promise(resolve=>{respond=()=>resolve(Response.json({item:{name:"Late item"}}));});};
  const {renderItem}=await import("../public/features/catalog.js");
  const root={innerHTML:"new page"},controller=new AbortController();
  const loading=renderItem(root,"late-quality-fixture",{signal:controller.signal});
  await request;controller.abort();respond();await loading;
  assert.equal(root.innerHTML,"new page");
});

test("search distinguishes item identifiers and labels seasons and promo codes correctly",()=>{
  const index=buildSearchIndex({items:[{name:"AI-2 Medkit",normalizedName:"ai-2"},{name:"Saiga shotgun",normalizedName:"saiga",description:"Made in 2026"}],information:[{type:"season",id:"season-1",name:"Kord Breach"},{type:"promo",id:"promo-1",name:"CODE2026"}]});
  assert.deepEqual(searchEntries(index,"AI-2").map(x=>x.name),["AI-2 Medkit"]);
  assert.equal(searchEntries(index,"kord")[0].type,"Сезон");
  assert.equal(searchEntries(index,"code2026")[0].type,"Промокод");
});

test("English map variants remain distinct in summaries and both detail modes",async()=>{
  const maps=JSON.parse(await fs.readFile(new URL("../public/data/en/maps.json",import.meta.url),"utf8"));
  for(const [slug,name]of [["night-factory","Night Factory"],["ground-zero-21","Ground Zero 21+"]]){
    assert.equal(maps.find(map=>map.routeSlug===slug).name,name);
    for(const mode of ["","pve/"]){const data=JSON.parse(await fs.readFile(new URL("../public/data/en/"+mode+"maps/"+slug+".json",import.meta.url),"utf8"));assert.equal(data.map.name,name);}
  }
});

test("news deduplication combines cross-platform copies without merging different days or categories",()=>{
  const title="The Kord Breach season will conclude on December 7.",entry={title,date:"2026-11-11",kind:"Игра"};
  assert.equal(dedupeNews([entry,{...entry,title:title.slice(4,-1)},{...entry,date:"2026-11-12"},{...entry,kind:"Приложение"}]).length,3);
});

test("malformed feed rows are skipped and old coordinates use readable localized age labels",()=>{
  assert.deepEqual(sanitizeGameInfo({version:1,records:[null,42],sources:[null]}).records,[]);
  const now=Date.UTC(2026,10,14),old=now-9*86400000;
  assert.match(fixAgeLabel(old,"en-US",now),/9.*days?.*ago/);
  assert.match(fixAgeLabel(old,"ru-RU",now),/9/);
  assert.equal(fixAgeLabel(NaN),"—");
});

test("camera quest removes demonstrated legacy copies without merging other objects or floors",()=>{
  const rich={id:"camera-233",name:"Camera",objDescription:["Destroy cameras"],position:{x:235.72,y:4,z:126.95},pointImages:["/camera.webp"]};
  const legacy={id:"234",name:"Destroy cameras",objDescription:[],position:{x:235.77,y:0,z:126.89}};
  const separate={id:"other-1",name:"Another camera",objDescription:["Destroy cameras"],position:{x:235.77,y:10,z:126.89}};
  const layer={questData:{normalizedName:"halloween-blind-the-enemy"},objectiveMarkers:[rich,legacy,separate]};
  assert.deepEqual(canonicalQuestLayer(layer).objectiveMarkers,[rich,separate]);
  const otherQuest={...layer,questData:{normalizedName:"ordinary-quest"}};
  assert.equal(canonicalQuestLayer(otherQuest),otherQuest);
  assert.equal(layer.objectiveMarkers.length,3);
});
