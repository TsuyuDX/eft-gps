import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseHTML} from 'linkedom';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'public/data'),out=path.join(base,'en'),cache=path.join(root,'work/english-cache');
await fs.mkdir(out,{recursive:true});await fs.mkdir(cache,{recursive:true});
const files=new Set(),failures=[],origin='https://www.tarkovhead.com';
const read=async p=>JSON.parse(await fs.readFile(path.join(base,p),'utf8'));
async function write(p,v){await fs.mkdir(path.dirname(path.join(out,p)),{recursive:true});await fs.writeFile(path.join(out,p),JSON.stringify(v));files.add(p);}
async function get(url,json=true){const file=path.join(cache,crypto.createHash('sha256').update(url).digest('hex')+(json?'.json':'.html'));try{const text=await fs.readFile(file,'utf8');return json?JSON.parse(text):text;}catch{}
 for(let retry=0;retry<3;retry++)try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();const value=json?JSON.parse(text):text;await fs.writeFile(file,text);return value;}catch(e){if(retry===2)throw e;await new Promise(r=>setTimeout(r,400*(retry+1)));}}
async function pool(jobs,fn,n=6){let cursor=0;await Promise.all(Array.from({length:n},async()=>{while(cursor<jobs.length){const i=cursor++;await fn(jobs[i],i);}}));}
function records(html){const out=[];for(const m of html.matchAll(/self.__next_f.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g))try{for(const line of JSON.parse(m[1]).split('\n'))try{out.push(JSON.parse(line.slice(line.indexOf(':')+1)));}catch{}}catch{}return out;}
function walk(x,fn){if(!x||typeof x!=='object')return;fn(x);for(const value of Object.values(x))walk(value,fn);}
function hydrate(html){const {document}=parseHTML(html);for(let round=0;round<6;round++){let changed=false;for(const template of [...document.querySelectorAll('template[id]')]){const hidden=document.getElementById(template.id.replace('B:','S:'));if(!hidden)continue;let next=template.nextSibling;while(next){if(next.nodeType===8&&next.textContent==='/$')break;const after=next.nextSibling;next.remove();next=after;}template.replaceWith(...hidden.childNodes);hidden.remove();changed=true;}if(!changed)break;}return document;}
const byKey={},byText={},namesBySlug={};
const endpoints=(await get('https://json.tarkov.dev/endpoints')).data.endpoints.filter(x=>x.translations);
await pool(endpoints,async endpoint=>{const url='https://json.tarkov.dev'+endpoint.path.replace('{{gameMode}}','regular');const [ru,en]=await Promise.all([get(url+'_ru'),get(url+'_en')]);Object.assign(byKey,en.data);for(const [key,value]of Object.entries(ru.data))if(typeof value==='string'&&typeof en.data[key]==='string'&&/[А-Яа-яЁё]/.test(value))byText[value]=en.data[key];});
console.log('Game text pairs',Object.keys(byText).length);
const first=await get(origin+'/api/item/list?gameMode=regular&locale=en&offset=0&limit=50');let catalog=[...first.items];
if(catalog.length<first.total){const size=catalog.length;const offsets=Array.from({length:Math.ceil(first.total/size)-1},(_,i)=>(i+1)*size);await pool(offsets,async offset=>{catalog.push(...(await get(origin+`/api/item/list?gameMode=regular&locale=en&offset=${offset}&limit=${size}`)).items);});}
for(const item of catalog)namesBySlug[item.normalizedName]=item.name;
await write('strings.json',{byKey,byText,namesBySlug});
function english(x){if(typeof x==='string')return byText[x]||x;if(Array.isArray(x))return x.map(english);if(!x||typeof x!=='object')return x;const v=Object.fromEntries(Object.entries(x).map(([k,v])=>[k,english(v)]));for(const [field,key]of [['name','Name'],['shortName','ShortName'],['description','Description']])if(field in v&&byKey[x.id+' '+key])v[field]=byKey[x.id+' '+key];if(v.name&&namesBySlug[x.normalizedName])v.name=namesBySlug[x.normalizedName];return v;}
for(const mode of ['regular','pve'])await write(mode+'/items.json',english(await read(mode+'/items.json')));
const maps=await read('maps.json');
await pool(['regular','pve'].flatMap(mode=>maps.map(map=>({mode,slug:map.normalizedName}))),async({mode,slug})=>{try{const en=await get(origin+`/api/map/${slug}?gameMode=${mode}&locale=en`);const ru=await read((mode==='pve'?'pve/':'')+'maps/'+slug+'.json');if(!en.map)throw Error('Map missing');for(const field of ['image','imageThumb','svg','svgLayers','layers'])if(ru.map[field]!==undefined&&/image|svg/i.test(field))en.map[field]=ru.map[field];await write((mode==='pve'?'pve/':'')+'maps/'+slug+'.json',en);}catch(e){failures.push({path:'map/'+mode+'/'+slug,error:e.message});}});
const summaries=[];for(const map of maps){const en=JSON.parse(await fs.readFile(path.join(out,'maps',map.normalizedName+'.json'),'utf8'));summaries.push({...map,name:en.map.name,description:en.map.description});}
await write('maps.json',summaries);
for(const mode of ['regular','pve']){
 const rows=(await get(origin+`/api/quest/list?gameMode=${mode}&locale=en`)).quests;
 const sourceRows=await read(mode+'/quests.json');const sourceSlugs=new Set(sourceRows.map(q=>q.normalizedName));const filtered=rows.filter(q=>sourceSlugs.has(q.normalizedName));
 if(filtered.length!==sourceRows.length)throw Error('English quest count differs for '+mode);
 const search={};let count=0;
 await pool(filtered,async(row,index)=>{const slug=row.normalizedName;try{const value=await get(origin+`/api/quest/${slug}?gameMode=${mode}&locale=en`);const q=value.quest;if(!q||q.normalizedName!==slug)throw Error('Quest identity mismatch');await write((mode==='pve'?'pve/':'')+'quests/'+slug+'.json',value);const text=[];walk(q,v=>{for(const key of ['text','name','description','caption','title'])if(typeof v[key]==='string')text.push(v[key]);});const locations=new Map();for(const obj of q.objectives||[])for(const m of [...obj.maps||[],...(obj.possibleLocations||[]).map(l=>l.map)])if(m?.normalizedName)locations.set(m.normalizedName,{name:m.name,normalizedName:m.normalizedName});search[slug]={name:q.name,trader:q.trader?.name||'Story',traderSlug:q.trader?.normalizedName||'',icon:row.iconLink||q.trader?.imageLink||q.taskImageLink,maps:[...locations.values()],text:text.join(' '),hasGuide:!!q.guide?.length||!!q.guideCms?.root?.children?.length};}catch(e){failures.push({path:'quest/'+mode+'/'+slug,error:e.message});}if(++count%100===0)console.log('English quests',mode,count,'/',filtered.length);});
 await write(mode+'/quests.json',filtered);await write(mode+'/quest-search.json',search);
}
let lookup={},categories=[],modifiers=[];
for(const url of ['/en/hideout/regular','/en/item/regular','/en/items-tracker/regular','/en/items-tracker/pve','/en/season']){
 const html=await get(origin+url,false);for(const r of records(html))walk(r,x=>{if(x.value?.hideout&&Object.keys(x.value.hideout).length)lookup=x.value;if(x.handbookCategories)categories=x.handbookCategories;if(x.modifiers)modifiers=x.modifiers;});
 let tracker;for(const r of records(html))walk(r,x=>{if(x.fullItemsDataMap)tracker={fullItemsDataMap:x.fullItemsDataMap,itemsData:x.itemsData};});if(tracker)await write(url.endsWith('/pve')?'pve/tracker.json':'tracker.json',tracker);
}
if(!Object.keys(lookup.hideout||{}).length)throw Error('English lookup missing');await write('lookup.json',lookup);await write('categories.json',categories.length?categories:english(await read('categories.json')));await write('modifiers.json',modifiers.length?modifiers:english(await read('modifiers.json')));
const articles=(await read('articles.json')).filter(a=>a.type!=='news');
await pool(articles,async(a,index)=>{try{const html=await get(origin+'/en/'+a.path,false),doc=hydrate(html),main=doc.querySelector('main');if(!main)throw Error('Article body missing');const title=main.querySelector('h1,h2')?.textContent.trim()||english(a.title);await write('articles/'+a.path.replaceAll('/','__')+'.json',{...a,title,html:main.innerHTML});a.title=title;
if(a.type==='trader'){const result={items:[],levels:[]};for(const r of records(html))walk(r,x=>{if(x.items?.[0]?.moneyOffers)result.items=x.items;if(x.levels?.[0]?.requiredCommerce!==undefined)result.levels=x.levels;});await write('traders/'+a.path.split('/').at(-1)+'.json',result);}}catch(e){failures.push({path:a.path,error:e.message});}});
await write('articles.json',articles);
// Item descriptions are translated from identifier-based game strings, preserving saved numeric data.
for(const mode of ['','pve/']){const directory=path.join(base,mode,'items');const names=await fs.readdir(directory);for(const name of names){if(!name.endsWith('.json'))continue;await write(mode+'items/'+name,english(JSON.parse(await fs.readFile(path.join(directory,name),'utf8'))));}}
const assets=await read('assets.json'),urls=new Set();
function collect(x){if(typeof x==='string'){if(x.startsWith('/api/media/file/')||x.startsWith('https://assets.tarkov.dev/')||x.startsWith('/api/wiki/image?')||x.startsWith(origin+'/api/media/file/')||x.startsWith('https://static.wikia.nocookie.net/'))urls.add(x);return;}if(x&&typeof x==='object')for(const value of Object.values(x))collect(value);}
for(const file of files){if(file==='strings.json')continue;const value=JSON.parse(await fs.readFile(path.join(out,file),'utf8'));if(value.html){const doc=hydrate(value.html);for(const image of doc.querySelectorAll('img')){let src=image.getAttribute('src')||'';if(src.startsWith('/_next/image'))src=new URL(src,origin).searchParams.get('url')||'';collect(src);}}collect(value);}
let imageCount=0;await pool([...urls].filter(u=>!assets[u]),async url=>{try{const r=await fetch(new URL(url,origin),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer()),type=r.headers.get('content-type')||'';if(!type.startsWith('image/'))throw Error('Not an image');const ext=type.includes('svg')?'.svg':type.includes('png')?'.png':type.includes('jpeg')?'.jpg':'.webp';const target='/assets/english/'+crypto.createHash('sha256').update(url).digest('hex').slice(0,24)+ext;await fs.mkdir(path.join(root,'public/assets/english'),{recursive:true});await fs.writeFile(path.join(root,'public',target),bytes);assets[url]=target;imageCount++;}catch(e){failures.push({asset:url,error:e.message});}},4);
await write('assets.json',assets);
await write('index.json',{format:1,files:[...files],savedAt:new Date().toISOString()});
await fs.writeFile(path.join(cache,'report.json'),JSON.stringify({files:files.size,images:imageCount,failures},null,2));
console.log('English snapshot ready',files.size,'files;',imageCount,'new images;',failures.length,'issues');
if(failures.some(f=>f.path))process.exitCode=1;


