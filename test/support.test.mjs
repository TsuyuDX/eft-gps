import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setLanguage} from '../public/core/localization.js';
import {supportUrl} from '../public/core/support-config.js';
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
    const document=dom(lang);openSupport();
    assert.equal(document.querySelectorAll('[data-support-provider]').length,2);
    assert.equal(document.querySelectorAll('.support-option button[disabled]').length,2);
    assert.equal(document.querySelectorAll('.support-panel a').length,0);
    assert.equal(document.querySelectorAll('.support-panel input,.support-panel form').length,0);
    assert.match(document.querySelector('.support-free').textContent,lang==='ru'?/бесплатно/:/free/);
    assert.match(document.querySelector('.support-pending').textContent,lang==='ru'?/не подключены/:/not connected/);
    assert.match(document.querySelector('.support-benefits').textContent,lang==='ru'?/только с вашего согласия/:/only with your permission/);
    assert.match(document.querySelector('.support-benefits').textContent,lang==='ru'?/Тестовые сборки/:/Test builds/);
    assert.match(document.querySelector('.support-benefits').textContent,lang==='ru'?/останутся бесплатными/:/remain free/);
  }
});
test('a verified profile enables only its own external link while missing or invalid profiles stay disabled',()=>{
  const document=dom('en');openSupport({boosty:'https://boosty.to/example_creator',kofi:'https://bad.test/fake'});
  const links=document.querySelectorAll('.support-panel a');assert.equal(links.length,1);
  assert.equal(links[0].getAttribute('href'),'https://boosty.to/example_creator');
  assert.equal(links[0].getAttribute('target'),'_blank');assert.match(links[0].getAttribute('rel'),/noopener/);
  assert.equal(document.querySelectorAll('.support-option button[disabled]').length,1);
});
