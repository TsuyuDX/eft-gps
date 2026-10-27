import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {validWindowSettings} from '../server/window-settings.mjs';
import {setLanguage,t,installLocalization} from '../public/core/localization.js';
import {prepareStartup,finishStartup} from '../public/core/startup.js';
function dom(html){const {document,window}=parseHTML(html);globalThis.document=document;globalThis.window=window;globalThis.Event=window.Event;globalThis.MutationObserver=window.MutationObserver;const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),key:i=>[...values.keys()][i],get length(){return values.size;}};return {document,window};}
test('locale settings accept supported storage shape and translations round-trip dynamic DOM without rewriting inputs',async()=>{
 const {document}=dom('<html><body><h1>Карты</h1><input placeholder="Найти предметы, задания, модули убежища" value="Моя заметка"></body></html>');
 assert.equal(validWindowSettings({version:1,values:{'tarkov-locale-v1':'{"language":"en"}'}}),true);
 setLanguage('en',{persist:false});installLocalization();
 assert.equal(t('Уровень 3'),'Level 3');assert.equal(document.querySelector('h1').textContent,'Maps');
 assert.equal(document.querySelector('input').getAttribute('placeholder'),'Search items, quests and hideout modules');
 const paragraph=document.createElement('p');paragraph.textContent='Задания';document.body.append(paragraph);
 await new Promise(r=>setTimeout(r,10));assert.equal(paragraph.textContent,'Quests');
 setLanguage('ru',{persist:false});assert.equal(paragraph.textContent,'Задания');assert.equal(document.querySelector('h1').textContent,'Карты');
 assert.equal(document.querySelector('input').getAttribute('value'),'Моя заметка');
});
test('startup completes real checks and opens the application without enabling screenshot capture',async()=>{
 const {document}=dom(await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8'));
 localStorage.setItem('tarkov-locale-v1','{"language":"ru"}');
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push([url,options?.method||'GET']);return {ok:true,json:async()=>url==='/api/startup'?{ready:true,checks:[{id:'database',label:'Локальная база',state:'ok'}],discovered:{screenshotsPath:'C:/screenshots',logsPath:'C:/logs'}}:{folderExists:true,logsExist:true,config:{enabled:false}}};};
 const result=await prepareStartup();assert.equal(document.querySelector('#boot-progress').getAttribute('aria-valuenow'),'100');
 await finishStartup(result);assert.equal(document.querySelector('#boot-screen'),null);assert.equal(document.body.classList.contains('booting'),false);
 assert.ok(calls.every(([url])=>!url.includes('/auto')));
});
