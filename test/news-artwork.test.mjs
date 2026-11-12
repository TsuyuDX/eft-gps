import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {officialArtworkUrl,gameArtwork,SEASON_BANNER,GAME_NEWS_FALLBACK} from '../public/core/news-artwork.js';
import {activeSeason,sanitizeGameInfo} from '../public/core/game-info-model.js';
import {GameInfoService} from '../server/game-info.mjs';
const now=Date.parse('2026-11-12T12:00:00Z');
test('season banner survives stale screenshot metadata and active status respects confirmed dates',()=>{
 assert.equal(gameArtwork({id:'kord-breach',image:'/assets/news/app-overview.png'}),SEASON_BANNER);
 assert.equal(gameArtwork({id:'news-test',image:'/assets/news/app-overview.png'}),GAME_NEWS_FALLBACK);
 const season={id:'kord-breach',type:'season',verified:'official',startsAt:'2026-08-03',endsOn:'2026-12-07'};
 assert.equal(activeSeason([season],now)?.id,season.id);
 for(const s of [{...season,verified:'unverified'},{...season,endedConfirmed:true},{...season,startsAt:'2027-01-01'}])assert.equal(activeSeason([s],now),null);
 assert.equal(activeSeason([season],Date.parse('2026-12-08')),null);
});
test('news artwork rejects arbitrary hosts, executable formats, redirects and credential URLs',()=>{
 const good='https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg';assert.equal(officialArtworkUrl(good),good);
 for(const url of ['http://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg','https://localhost/a.jpg','https://i.ytimg.com.evil.test/vi/abcdefghijk/hqdefault.jpg','https://user:pass@i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',good+'?redirect=https://evil.test','https://cdn4.telesco.pe/file/image.svg'])assert.equal(officialArtworkUrl(url),null,url);
 assert.equal(gameArtwork({id:'news-test',imageRemote:good}),'/api/game-info/image/news-test');
});
test('bundled publication art has source attribution and matches every recorded checksum',async()=>{
 const provenance=JSON.parse(await fs.readFile('public/data/news-artwork-sources.json','utf8'));
 const index=JSON.parse(await fs.readFile('public/data/news-artwork.json','utf8'));
 assert.ok(Object.keys(index).length>=10);
 for(const item of provenance.images){assert.ok(officialArtworkUrl(item.image));assert.match(item.source,/^https:\/\//);const b=await fs.readFile(path.join('public',item.file));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),item.sha256);}
});
test('publication image service caches valid publisher raster data, works offline and blocks unlisted requests',async()=>{
 const root=await fs.mkdtemp(path.resolve('work/artwork-test-'));
 try{
 await fs.mkdir(path.join(root,'public/data'),{recursive:true});
 const data=JSON.parse(await fs.readFile('public/data/game-info.json','utf8'));
 const record=data.records.find(x=>x.imageRemote);assert.ok(record);data.records=[record];
 await fs.writeFile(path.join(root,'public/data/game-info.json'),JSON.stringify(data));
 const b=await fs.readFile('public/assets/news/eft-keyart.jpg');let calls=0;
 const service=new GameInfoService(root,{network:true,fetcher:async(url,options)=>{calls++;assert.equal(url,record.imageRemote);assert.equal(options.redirect,'error');return new Response(b,{headers:{'Content-Type':'image/jpeg'}});}});
 assert.equal((await service.image(record.id)).type,'image/jpeg');assert.equal(calls,1);
 assert.deepEqual((await service.image(record.id)).bytes,b);assert.equal(calls,1);
 assert.equal(await service.image('../secret'),null);assert.equal(await service.image('missing'),null);assert.equal(calls,1);
 const offline=new GameInfoService(root,{network:false});assert.deepEqual((await offline.image(record.id)).bytes,b);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
