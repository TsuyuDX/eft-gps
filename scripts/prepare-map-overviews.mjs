// Real overhead map tiles from the map's existing attributed provider.
// These are game renders, never real-world satellite photographs.
import fs from "node:fs/promises";
import path from "node:path";
const output={version:1,maps:{}};
for(const name of await fs.readdir('public/data/maps')){
  const {map:m}=JSON.parse(await fs.readFile('public/data/maps/'+name));
  const slug=name.replace('.json','');
  if(!m.tilePath)continue;
  const z=3,size=m.tileSize||256,a=m.transform,r=(m.coordinateRotation||0)*Math.PI/180;
  if(!a||!m.bounds)continue;
  const p=([x,y])=>[2**z*(a[0]*(x*Math.cos(r)-y*Math.sin(r))+a[1]),2**z*(-a[2]*(x*Math.sin(r)+y*Math.cos(r))+a[3])];
  const b=m.svgBounds||m.bounds,c=[p(b[0]),p(b[1]),p([b[0][0],b[1][1]]),p([b[1][0],b[0][1]])];
  const minX=Math.min(...c.map(p=>p[0])),minY=Math.min(...c.map(p=>p[1])),w=Math.max(...c.map(p=>p[0]))-minX,h=Math.max(...c.map(p=>p[1]))-minY;
  const dir=`work/map-overview-cache/${slug}`;await fs.mkdir(dir,{recursive:true});
  const jobs=[];for(let x=Math.max(0,Math.floor(minX/size));x<=Math.floor((minX+w)/size);x++)for(let y=Math.max(0,Math.floor(minY/size));y<=Math.floor((minY+h)/size);y++)jobs.push({x,y});
  const images=[];let cursor=0,failures=0;
  await Promise.all(Array.from({length:3},async()=>{for(;;){const t=jobs[cursor++];if(!t)return;const {x,y}=t,file=`${dir}/${x}-${y}.png`;
    try{let bytes;try{bytes=await fs.readFile(file)}catch{const u=m.tilePath.replace('{z}',z).replace('{x}',x).replace('{y}',y);const response=await fetch(u,{signal:AbortSignal.timeout(15000)});if(response.status===404)return;if(!response.ok)throw Error(String(response.status));bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>1024*1024||bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Invalid PNG');await fs.writeFile(file,bytes)}images.push(`<image x="${x*size}" y="${y*size}" width="${size}" height="${size}" href="data:image/png;base64,${bytes.toString('base64')}"/>`)}catch{failures++}
  }}));
  if(!images.length||failures){console.log(slug,'incomplete',failures,images.length);continue}
  const file=`/assets/map-overview/${slug}.svg`;
  await fs.writeFile('public'+file,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}"><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#101815"/>${images.join('')}</svg>`);
  output.maps[slug]={path:file,source:m.authorLink||'https://tarkov.dev/maps',tiles:m.tilePath,kind:'game-overhead',bounds:b,coordinateRotation:m.coordinateRotation,tilesCount:images.length};
  console.log(slug,images.length,'tiles');
}
await fs.writeFile('public/data/map-styles.json',JSON.stringify(output));
