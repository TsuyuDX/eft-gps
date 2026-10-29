import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {validProfile} from '../public/core/profile-schema.js';
import {validate as validateImportedProfile} from '../public/core/state.js';
import {asset, localHref, db} from '../public/core/data.js';
import {rich} from '../public/core/ui.js';
const blank=()=>({quests:{},objectives:{},inventory:{},hideout:{},pins:{},favorites:[],modifiers:[],notes:''});
const profile=()=>({version:1,mode:'regular',modes:{regular:blank(),pve:blank()}});
test('profile import rejects markup in numeric fields, malformed pins and prototype keys',()=>{
 assert.equal(validProfile(profile()),true);
 const mutations=[p=>p.mode='unknown',p=>p.modes.regular.hideout.heating='\"><img src=x>',p=>p.modes.pve.inventory.money=-1,p=>p.modes.pve.inventory.money=Infinity,p=>p.modes.regular.quests.debut={},p=>p.modes.regular.pins.customs=[{x:'1',y:2,name:'pin',layer:''}],p=>p.modes.regular.favorites=[{}],p=>p.modes.regular.hideout=JSON.parse('{"__proto__":1}')];
 for(const mutate of mutations){const p=profile();mutate(p);assert.equal(validProfile(p),false);assert.throws(()=>validateImportedProfile(p));}
 const p=profile();p.modes.regular.pins.customs=[{x:1,y:2,name:'My pin',layer:'0'}];assert.equal(validProfile(p),true);
});
test('reference links and assets reject executable protocols and attribute injection',()=>{
 for(const href of ['javascript:alert(1)','java\nscript:alert(1)','data:text/html,hello','file:///C:/Windows','ms-settings:','//evil.test/path'])assert.equal(localHref(href).startsWith('#'),true);
 assert.equal(localHref('https://www.escapefromtarkov.com/'),'https://www.escapefromtarkov.com/');
 assert.equal(localHref('/ru/quest/regular/debut'),'#/quest/regular/debut');
 assert.equal(rich({type:'link',href:'javascript:alert(1)',text:'unsafe'}).includes('javascript:'),false);
 for(const value of ['/assets/x" onerror="alert(1)','/assets/../server.mjs','https://evil.test/pixel'])assert.equal(asset(value),'/assets/fallback.svg');
 db.assets['bad-test']='/assets/bad" onload="x';assert.equal(asset('bad-test'),'/assets/fallback.svg');delete db.assets['bad-test'];
});
test('live server blocks foreign origins, rebinding, static junction escapes and invalid profile writes',async t=>{
 const directory=await fs.mkdtemp(path.join(process.cwd(),'work/security-server-'));
 let child; t.after(async()=>{if(child && child.exitCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}await fs.rm(directory,{recursive:true,force:true});});
 for(const file of ['server.mjs','server/app-update.mjs','server/startup.mjs','server/gps.mjs','server/screenshot-cleanup.mjs','server/window-settings.mjs','public/core/gps-format.js','public/core/profile-schema.js']){
   await fs.mkdir(path.dirname(path.join(directory,file)),{recursive:true});await fs.copyFile(file,path.join(directory,file));
 }
 await fs.writeFile(path.join(directory,'package.json'),JSON.stringify({type:'module',version:'1.8.1'}));
 await fs.writeFile(path.join(directory,'public/index.html'),'safe interface');
 const outside=path.join(directory,'private');await fs.mkdir(outside);await fs.writeFile(path.join(outside,'secret.txt'),'private test secret');
 await fs.symlink(outside,path.join(directory,'public/escape'),process.platform==='win32'?'junction':'dir');
 const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 child=spawn(process.execPath,[path.join(directory,'server.mjs')],{cwd:directory,env:{...process.env,PORT:String(port),EFTGPS_PREVIEW:"1"},stdio:['ignore','pipe','pipe'],windowsHide:true});

 let errors='';child.stderr.on('data',b=>errors+=b);const origin='http://127.0.0.1:'+port;
 let ready=false;for(let i=0;i<120;i++){try{const r=await fetch(origin+'/api/health');if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert.equal(ready,true,errors);
 const r=await fetch(origin+'/');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'self'/);
 assert.equal((await fetch(origin+'/api/profile',{headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await fetch(origin+'/api/gps/state',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
 const badHost=await new Promise((resolve,reject)=>{const request=http.get(origin+'/api/health',{headers:{Host:'evil.test'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});request.on('error',reject);});assert.equal(badHost,403);
 assert.equal((await fetch(origin+'/escape/secret.txt')).status,404);
 assert.equal((await fetch(origin+'/%')).status,400);
 const headers={Origin:origin,'Content-Type':'application/json'};
 assert.equal((await fetch(origin+'/api/app-update/start',{method:'POST',headers})).status,202);
 assert.deepEqual(await fetch(origin+'/api/app-update/state').then(r=>r.json()),{phase:'current',preview:true});
 assert.equal((await fetch(origin+'/api/profile',{method:'PUT',headers,body:'{bad'})).status,400);
 const invalid=profile();invalid.modes.regular.hideout.heating='unsafe';
 assert.equal((await fetch(origin+'/api/profile',{method:'PUT',headers,body:JSON.stringify(invalid)})).status,400);
 assert.equal((await fetch(origin+'/api/profile',{method:'PUT',headers,body:JSON.stringify(profile())})).status,204);
 assert.deepEqual(await fetch(origin+'/api/profile').then(r=>r.json()),profile());
 assert.equal((await fetch(origin+'/api/gps/settings',{method:'POST',headers,body:JSON.stringify({screenshotsPath:'//unavailable.invalid/share'})})).status,400);
 const shots=path.join(directory,'Скриншоты');await fs.mkdir(shots);const body=Buffer.from(JSON.stringify({screenshotsPath:shots,enabled:false}));const split=body.indexOf(Buffer.from('Скриншоты'))+1;
 const configured=await new Promise((resolve,reject)=>{const request=http.request(origin+'/api/gps/settings',{method:'POST',headers},response=>{const chunks=[];response.on('data',b=>chunks.push(b));response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(Buffer.concat(chunks))}));});request.on('error',reject);request.write(body.subarray(0,split));setTimeout(()=>request.end(body.subarray(split)),10);});
 assert.equal(configured.status,200);assert.equal(configured.data.config.screenshotsPath,shots);

});
