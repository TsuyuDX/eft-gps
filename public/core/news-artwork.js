// Only publisher-provided raster thumbnails; browsers never load third-party URLs directly.
export const GAME_NEWS_FALLBACK="/assets/news/eft-keyart.jpg";
export const SEASON_BANNER="/assets/news/kord-breach.webp";
export function officialArtworkUrl(value){try{
 const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||u.port||value.length>1800)return null;
 const h=u.hostname,p=u.pathname;
 const allowed=(/^cdn[1-9]\.telesco\.pe$/.test(h)&&/^\/file\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(p)) ||
  (["i.ytimg.com","i1.ytimg.com","i2.ytimg.com","i3.ytimg.com","i4.ytimg.com"].includes(h)&&/^\/vi\/[A-Za-z0-9_-]{11}\/(?:hqdefault|mqdefault|maxresdefault|sddefault)\.jpg$/.test(p)) ||
  (["clan.akamai.steamstatic.com","clan.fastly.steamstatic.com"].includes(h)&&/^\/images\/[0-9]+\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(p)) ||
  (["shared.fastly.steamstatic.com","shared.akamai.steamstatic.com"].includes(h)&&/^\/store_item_assets\/steam\/apps\/3932890\/(?:[a-f0-9]+\/)?(?:header(?:_alt_assets_[0-9]+)?|library_hero|capsule_616x353|ss_[a-f0-9]+)\.(jpg|png)$/.test(p));
 return allowed && (!u.search || /^\?t=[0-9]+$/.test(u.search))?u.href:null;
}catch{return null;}}
export function gameArtwork(record){
 if(record.id==="kord-breach")return SEASON_BANNER;
 if(typeof record.image==="string" && /^\/assets\/news\/[a-z0-9-]+\.(png|jpg|webp)$/.test(record.image) && !record.image.startsWith("/assets/news/app-"))return record.image;
 if(officialArtworkUrl(record.imageRemote) && /^[a-z0-9-]{1,100}$/.test(record.id))return "/api/game-info/image/"+record.id;
 return GAME_NEWS_FALLBACK;
}
