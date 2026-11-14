import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {createReadStream} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

// Inventory the Git checkout, including new non-ignored source files. Never include user data.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const listed=execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{cwd:root,maxBuffer:32*1024*1024}).toString().split("\0").filter(Boolean);
const paths=[...new Set(listed)].filter(file=>file!=="distribution/package-files.json" &&
  !/^(?:userdata|work|outputs|\.git)\//.test(file) &&
  file!=="runtime/MicrosoftEdgeWebView2RuntimeInstallerX64.exe").sort();
const files=[];let cursor=0,done=0;
await Promise.all(Array.from({length:8},async()=>{for(;;){
  const relative=paths[cursor++];if(!relative)return;
  const file=path.join(root,relative),stat=await fs.lstat(file).catch(error=>{if(error.code==="ENOENT")return null;throw error;});
  if(!stat)continue; // A staged deletion must not remain in the inventory.
  if(!stat.isFile()||stat.isSymbolicLink())throw Error("Unsafe inventory entry: "+relative);
  const hash=crypto.createHash("sha256");
  for await(const chunk of createReadStream(file))hash.update(chunk);
  files.push({path:relative,size:stat.size,sha256:hash.digest("hex")});
  if(++done%10000===0)console.log("Inventory checked:",done,"/",paths.length);
}}));
files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
const {version}=JSON.parse(await fs.readFile(path.join(root,"package.json"),"utf8"));
await fs.writeFile(path.join(root,"distribution/package-files.json"),JSON.stringify({format:1,version,files})+"\n");
console.log(JSON.stringify({version,files:files.length,bytes:files.reduce((sum,file)=>sum+file.size,0)}));
