import { language } from './localization.js';
let started=false;
export function startAppUpdates() {
  if(started) return;started=true;
  const panel=document.createElement('aside');panel.className='app-update';panel.hidden=true;panel.dataset.noTranslate='';
  panel.innerHTML='<div class="app-update-copy" role="status" aria-live="polite"></div><button class="app-update-dismiss" aria-label="Close">×</button><progress max="100" value="0"></progress>';
  document.body.append(panel);
  let dismissed=false;
  panel.querySelector('button').onclick=()=>{dismissed=true;panel.hidden=true;};
  const L=(ru,en)=>language()==='en'?en:ru;
  async function poll() {
    try {
      const response=await fetch('/api/app-update/state',{cache:'no-store'});
      if(!response.ok) return;
      const state=await response.json();
      if(['idle','checking','current'].includes(state.phase)) {
        if(state.phase==='current') return;
      } else {
        panel.hidden=dismissed;
        panel.querySelector('progress').value=state.percent;
        const mb=value=>(value/1024**2).toFixed(1);
        panel.querySelector('.app-update-copy').textContent=state.phase==='downloading'
          ? L(state.kind==='delta'?'Загрузка изменений':'Загрузка обновления',state.kind==='delta'?'Downloading changes':'Downloading update')+` ${state.version} · ${state.percent}% · ${state.file} · ${mb(state.downloaded)} / ${mb(state.total)} MB`
          : state.phase==='verifying' ? L('Проверка обновления…','Verifying update…')
          : state.phase==='installer' ? L('Обновление загружено · 100%. Открыто окно обновления.','Update downloaded · 100%. The update window is open.')
          : state.error==='disk-space' ? L('Для обновления не хватает места. Текущая версия продолжает работать.','Not enough disk space. Your current version remains available.')
          : state.error==='checksum' ? L('Проверка обновления не пройдена. Файлы приложения не изменены.','Update verification failed. Application files were not changed.')
          : L('Обновления сейчас недоступны. Проверим при следующем запуске.','Updates are unavailable. We will check on the next launch.');
        if(['installer','error'].includes(state.phase)) return;
      }
      setTimeout(poll,750);
    } catch { /* Offline and shutdown must not interrupt the application. */ }
  }
  fetch('/api/app-update/start',{method:'POST'}).then(response=>{if(response.ok)poll();}).catch(()=>{});
}
