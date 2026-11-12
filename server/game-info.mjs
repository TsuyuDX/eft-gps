import {officialArtworkUrl} from "../public/core/news-artwork.js";
import {rasterInfo} from "./graphics-gallery.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  sanitizeGameInfo,
  mergeGameInfo,
  INFO_INTERVAL,
} from "../public/core/game-info-model.js";
export const INFO_FEED_URL =
  "https://raw.githubusercontent.com/TsuyuDX/eft-gps/content-feed/feed.json";
export class GameInfoService {
  constructor(
    root,
    {
      fetcher = fetch,
      clock = Date.now,
      network = process.env.EFTGPS_NO_EVENT_NETWORK !== "1",
    } = {},
  ) {
    this.root = root;
    this.fetcher = fetcher;
    this.clock = clock;
    this.network = network;
    this.file = path.join(root, "userdata/game-info/feed.json");
    this.state = { phase: "bundled", lastSuccess: null, lastAttempt: null };
    this.ready = this.load();
    this.pending = null;
    this.images=new Map();this.imageAttempts=new Map();
    this.lastAttempt = 0;
  }
  async safeDirectory(create = false) {
    for (const folder of [
      path.join(this.root, "userdata"),
      path.dirname(this.file),
    ]) {
      if (create) await fs.mkdir(folder, { recursive: true });
      try {
        const stat = await fs.lstat(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw Error("unsafe-info-cache");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
  async load() {
    this.bundledArtwork=await fs.readFile(path.join(this.root,"public/data/news-artwork.json"),"utf8").then(JSON.parse).catch(()=>({}));
    this.data = sanitizeGameInfo(
      JSON.parse(
        await fs.readFile(
          path.join(this.root, "public/data/game-info.json"),
          "utf8",
        ),
      ),
    );
    try {
      await this.safeDirectory();
      const stat = await fs.lstat(this.file);
      if (
        stat.isSymbolicLink() ||
        !stat.isFile() ||
        stat.size > 2 * 1024 * 1024
      )
        throw Error("unsafe-info-cache");
      this.data = mergeGameInfo(
        this.data,
        sanitizeGameInfo(JSON.parse(await fs.readFile(this.file, "utf8"))),
      );
      this.state.phase = "cached";
    } catch (e) {
      if (e.code !== "ENOENT") this.state.phase = "cache-unavailable";
    }
    this.state.lastSuccess = this.data.lastSuccess;
  }
  async check({ force = false } = {}) {
    await this.ready;
    if (!this.network) return this.payload();
    if (this.pending) return this.pending;
    const now = this.clock();
    if (
      this.lastAttempt &&
      now - this.lastAttempt < (force ? 60000 : INFO_INTERVAL)
    )
      return this.payload();
    this.lastAttempt = now;
    this.state.lastAttempt = new Date(now).toISOString();
    this.state.phase = "checking";
    this.pending = (async () => {
      try {
        const r = await this.fetcher(INFO_FEED_URL, {
          redirect: "error",
          signal: AbortSignal.timeout(12000),
          headers: { "User-Agent": "EFTGPS-game-information" },
        });
        if (!r.ok) throw Error("feed-unavailable");
        const chunks = [];
        let size = 0;
        for await (const b of r.body) {
          size += b.length;
          if (size > 2 * 1024 * 1024) throw Error("feed-too-large");
          chunks.push(Buffer.from(b));
        }
        const incoming = sanitizeGameInfo(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        if (
          !incoming.generatedAt ||
          Date.parse(incoming.generatedAt) > now + 300000 ||
          (this.data.generatedAt &&
            incoming.generatedAt < this.data.generatedAt)
        )
          throw Error("invalid-feed-date");
        const merged = mergeGameInfo(this.data, incoming);
        await this.safeDirectory(true);
        const temp =
          this.file + "." + crypto.randomBytes(8).toString("hex") + ".tmp";
        try {
          await fs.writeFile(temp, JSON.stringify(merged), { flag: "wx" });
          await fs.rename(temp, this.file);
        } finally {
          await fs.unlink(temp).catch(() => {});
        }
        this.data = merged;
        this.state.phase = "current";
        this.state.lastSuccess = merged.lastSuccess;
      } catch {
        this.state.phase = "offline";
      }
      return this.payload();
    })().finally(() => (this.pending = null));
    return this.pending;
  }
  async image(id){
    await this.ready;if(!/^[a-z0-9-]{1,100}$/.test(id))return null;
    const record=this.data.records.find(x=>x.id===id),url=officialArtworkUrl(record?.imageRemote);if(!url)return null;
    const kind=bytes=>{if(bytes.length<24)throw Error("invalid-news-image");if(bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP")return "image/webp";const info=rasterInfo(bytes);return info.ext==="png"?"image/png":"image/jpeg";};
    const bundled=this.bundledArtwork[url];
    if(typeof bundled==="string" && /^\/assets\/news\/news-[a-f0-9]{24}\.(jpg|png|webp)$/.test(bundled)){
      try{const bytes=await fs.readFile(path.join(this.root,"public",bundled));return {bytes,type:kind(bytes)};}catch{}
    }
    const directory=path.join(path.dirname(this.file),"artwork"),file=path.join(directory,crypto.createHash("sha256").update(url).digest("hex")+".img");
    try{await this.safeDirectory();const dir=await fs.lstat(directory);if(dir.isSymbolicLink()||!dir.isDirectory())throw Error("unsafe-news-cache");const stat=await fs.lstat(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>4*1024*1024)throw Error("unsafe-news-image");const bytes=await fs.readFile(file);return {bytes,type:kind(bytes)};}catch{}
    if(!this.network)return null;
    if(this.images.has(url))return this.images.get(url);
    if(this.images.size>=4 || (this.imageAttempts.has(url)&&this.clock()-this.imageAttempts.get(url)<300000))return null;
    this.imageAttempts.set(url,this.clock());
    const job=(async()=>{try{
      const response=await this.fetcher(url,{redirect:"error",signal:AbortSignal.timeout(8000)});if(!response.ok || !/^image\/(jpeg|png|webp)(?:;|$)/i.test(response.headers.get("content-type")||""))return null;
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>4*1024*1024)throw Error("news-image-too-large");chunks.push(Buffer.from(chunk));}
      const bytes=Buffer.concat(chunks),type=kind(bytes);await this.safeDirectory(true);await fs.mkdir(directory,{recursive:true});const stat=await fs.lstat(directory);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error("unsafe-news-cache");
      const files=[];for(const name of await fs.readdir(directory)){if(!/^[a-f0-9]{64}\.img$/.test(name))continue;const p=path.join(directory,name),s=await fs.lstat(p);if(s.isFile()&&!s.isSymbolicLink())files.push({p,size:s.size,time:s.mtimeMs});}
      let total=files.reduce((n,x)=>n+x.size,0);for(const old of files.sort((a,b)=>a.time-b.time)){if(total+bytes.length<=64*1024*1024)break;await fs.unlink(old.p);total-=old.size;}
      const tmp=file+"."+crypto.randomBytes(8).toString("hex")+".tmp";try{await fs.writeFile(tmp,bytes,{flag:"wx"});await fs.rename(tmp,file);}finally{await fs.unlink(tmp).catch(()=>{});}return {bytes,type};
    }catch{return null;}})().finally(()=>this.images.delete(url));this.images.set(url,job);return job;
  }
  payload() {
    return { state: { ...this.state }, data: this.data };
  }
}
