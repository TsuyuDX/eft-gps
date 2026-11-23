// Read-only audit. Only coordinate filenames and relevant raid events are used.
import fs from "node:fs/promises";
import path from "node:path";
import { parseScreenshot, parseLogLine, floorFor } from "../public/core/gps-format.js";
import { projectPoint } from "../public/core/domain.js";
const [shots, logs] = process.argv.slice(2);
if (!shots || !logs) throw Error("Usage: node scripts/audit-gps-samples.mjs <screenshots> <logs>");
const events = [];
for (const entry of await fs.readdir(logs, {withFileTypes:true})) {
  if (!entry.isDirectory() || !entry.name.startsWith("log_")) continue;
  for (const name of await fs.readdir(path.join(logs,entry.name))) {
    if (!/application.*\.log$/i.test(name)) continue;
    const text = await fs.readFile(path.join(logs,entry.name,name),"utf8");
    for (const line of text.split(/\r?\n/)) {
      const event = parseLogLine(line);
      if (!event?.map && event?.raid !== "ended") continue;
      const time = Date.parse(line.slice(0,23).replace(" ","T"));
      if (Number.isFinite(time)) events.push({time,...event});
    }
  }
}
events.sort((a,b)=>a.time-b.time);
const maps=new Map(), grouped={}, samples=[];
for (const name of await fs.readdir(shots)) {
  const fix=parseScreenshot(name); if(!fix)continue;
  const stamp=name.match(/^(\d{4}-\d\d-\d\d)\[(\d\d)-(\d\d)/);
  const time=Date.parse(`${stamp[1]}T${stamp[2]}:${stamp[3]}:59`);
  const event=events.findLast(e=>e.time<=time);
  if(!event?.map || time-event.time>4*3600000)continue;
  if(!maps.has(event.map))maps.set(event.map,JSON.parse(await fs.readFile(`public/data/maps/${event.map}.json`)).map);
  const map=maps.get(event.map), p=projectPoint(fix.position,map);
  const valid=Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100;
  const g=grouped[event.map]||={count:0,inBounds:0,outside:0,floors:{},example:null};
  g.count++;g[valid?'inBounds':'outside']++;
  const floor=floorFor(fix.position,map);g.floors[floor]=(g.floors[floor]||0)+1;
  if(valid){g.example=name;samples.push({map:event.map,filename:name,position:fix.position,projected:p,floor});}
}
await fs.mkdir('work/gps-audit',{recursive:true});
await fs.writeFile('work/gps-audit/samples.json',JSON.stringify(samples,null,2));
console.log(JSON.stringify({note:'Filename parsing, log association and projection only; not a visual in-raid ground-truth measurement.',maps:grouped},null,2));
