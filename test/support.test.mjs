import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setLanguage} from '../public/core/localization.js';
import {supportUrl,supportCommunity,supportLinks} from '../public/core/support-config.js';
import {openSupport} from '../public/features/support.js';
function dom(lang) {
  const {document,window}=parseHTML('<html><body><dialog id="modal"><div id="modal-content"></div></dialog></body></html>');
  Object.assign(globalThis,{document,window,Event:window.Event});
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  document.querySelector('#modal').showModal=()=>{};
  setLanguage(lang,{persist:false});return document;
}
test('support URLs only accept public HTTPS profile pages from the configured provider',()=>{
  assert.equal(supportUrl('boosty','https://boosty.to/example_creator'),'https://boosty.to/example_creator');
  assert.equal(supportUrl('kofi','https://ko-fi.com/example_creator'),'https://ko-fi.com/example_creator');
  for(const value of ['',null,'javascript:alert(1)','http://ko-fi.com/example','https://ko-fi.com.evil.test/example','https://boosty.to/example','https://ko-fi.com/example?token=secret','https://name:password@ko-fi.com/example','https://ko-fi.com/','https://ko-fi.com:444/example'])
    assert.equal(supportUrl('kofi',value),null);
});
test('unconfigured support renders in both languages without active payment links or card inputs',()=>{
  for(const lang of ['ru','en']) {
    const document=dom(lang);openSupport({});
    assert.equal(document.querySelectorAll('[data-support-provider]').length,3);
    assert.equal(document.querySelectorAll('.support-option button[disabled]').length,3);
    assert.equal(document.querySelectorAll('.support-panel a').length,0);
    assert.equal(document.querySelectorAll('.support-panel input,.support-panel form').length,0);
    assert.match(document.querySelector('.support-free').textContent,lang==='ru'?/бесплатн/:/free/);
    assert.match(document.querySelector('.support-pending').textContent,lang==='ru'?/не подключены/:/not connected/);
    assert.match(document.querySelector('.support-benefits').textContent,lang==='ru'?/только с вашего согласия/i:/only with your permission/i);
    assert.match(document.querySelector('.support-benefits').textContent,lang==='ru'?/Тестовые сборки/:/Test builds/);
    assert.match(document.querySelector('.support-benefits').textContent,lang==='ru'?/останутся бесплатными/:/remain free/);
  }
});

test('Discord invites enable only the community action and reject unrelated or unsafe URLs',()=>{
  for(const url of ['https://discord.gg/example','https://discord.com/invite/example'])assert.equal(supportUrl('discord',url),url);
  for(const url of ['http://discord.gg/example','https://discord.gg.evil.test/example','https://discord.com/login','https://discord.gg/example?token=private','javascript:alert(1)'])assert.equal(supportUrl('discord',url),null);
  const document=dom('en');openSupport({discord:'https://discord.gg/example'});
  assert.equal(document.querySelectorAll('.support-option button[disabled]').length,3);
  assert.equal(document.querySelector('.support-discord').getAttribute('href'),'https://discord.gg/example');
  assert.match(document.querySelector('.support-discord-note').textContent,/Boosts help the Discord server/);
});

test('temporary fictional supporters exercise chips, consent filtering and goal clamping, then leave no demo data',()=>{
  const document=dom('ru');
  const fictional={goal:3,confirmedSponsors:5,sponsors:[
    {nickname:'DEMO_Sponsor',verified:true,consent:true},
    {nickname:'DEMO_Sponsor',verified:true,consent:true},
    {nickname:'NOT_PUBLIC',verified:true,consent:false},
    {nickname:'NOT_VERIFIED',verified:false,consent:true},
    {nickname:'<img src=x onerror=alert(1)>',verified:true,consent:true},
  ],boosters:[{nickname:'DEMO_Booster',verified:true,consent:true}]};
  openSupport({},fictional);
  assert.equal(document.querySelectorAll('.support-nickname').length,3);
  assert.equal(document.querySelectorAll('.support-nicknames img').length,0);
  assert.doesNotMatch(document.querySelector('.support-panel').textContent,/NOT_PUBLIC|NOT_VERIFIED/);
  assert.equal(document.querySelector('progress').getAttribute('value'),'3');
  openSupport();
  assert.equal(document.querySelectorAll('.support-nickname').length,0);
  assert.equal(document.querySelectorAll('progress').length,0);
  assert.doesNotMatch(document.querySelector('.support-panel').textContent,/DEMO_/);
  assert.equal(supportCommunity.goal,null);assert.deepEqual(supportCommunity.sponsors,[]);assert.deepEqual(supportCommunity.boosters,[]);
  assert.equal(supportLinks.discord,'');
});
test('a verified profile enables only its own external link while missing or invalid profiles stay disabled',()=>{
  const document=dom('en');openSupport({boosty:'https://boosty.to/example_creator',kofi:'https://bad.test/fake'});
  const links=document.querySelectorAll('.support-panel a');assert.equal(links.length,1);
  assert.equal(links[0].getAttribute('href'),'https://boosty.to/example_creator');
  assert.equal(links[0].getAttribute('target'),'_blank');assert.match(links[0].getAttribute('rel'),/noopener/);
  assert.equal(document.querySelectorAll('.support-option button[disabled]').length,2);
});

 test('configured Boosty buttons distinguish monthly membership from one-time donations',()=>{
  for(const lang of ['ru','en']){
    const document=dom(lang);openSupport();
    const member=document.querySelector('[data-support-provider="boostySubscription"] a');
    const donation=document.querySelector('[data-support-provider="boosty"] a');
    assert.equal(member.getAttribute('href'),'https://boosty.to/tsuyueftgps/purchase/4150607');
    assert.equal(donation.getAttribute('href'),'https://boosty.to/tsuyueftgps/donate');
    assert.match(member.textContent,lang==='ru'?/ежемесячная/:/monthly/);
    assert.match(donation.textContent,lang==='ru'?/без подписки/:/no subscription/);
  }
  for(const value of ['https://boosty.to/tsuyueftgps/purchase/not-a-number','https://boosty.to.evil.test/tsuyueftgps/purchase/4150607','https://boosty.to/tsuyueftgps/donate?token=secret'])assert.equal(supportUrl('boostySubscription',value),null);
});
