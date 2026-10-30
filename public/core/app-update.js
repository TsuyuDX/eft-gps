import { language } from './localization.js';
let started=false;
export function startAppUpdates() {
  if(started) return;started=true;
  const panel=document.createElement('aside');panel.className='app-update';panel.hidden=true;panel.dataset.noTranslate='';
  panel.innerHTML='<div class="app-update-copy" role="status" aria-live="polite"></div><button class="app-update-dismiss" aria-label="Close"><svg class="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><progress max="100" value="0"></progress>';
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
        panel.querySelector('progress').hidden=['error','cancelled'].includes(state.phase);
        const mb=value=>(value/1024**2).toFixed(1);
        panel.querySelector('.app-update-copy').textContent=state.phase==='downloading'
          ? L(state.kind==='delta'?'Загрузка изменений':'Загрузка обновления',state.kind==='delta'?'Downloading changes':'Downloading update')+` ${state.version} · ${state.percent}% · ${state.file} · ${mb(state.downloaded)} / ${mb(state.total)} MB`
          : state.phase==='verifying' ? L('Проверка обновления…','Verifying update…')
          : state.phase==='installer' ? L('Обновление загружено · 100%. Подтвердите запрос Windows и установку.','Update downloaded · 100%. Confirm the Windows prompt and installation.')
          : state.phase==='cancelled' ? L('Обновление отменено. Текущая версия продолжает работать.','Update cancelled. Your current version remains available.')
          : ['installer-missing','installer-access','installer-start'].includes(state.error) ? L('Обновление загружено и проверено · 100%. Не удалось запустить установщик: компонент отсутствует, недоступен или заблокирован Windows. Пакет сохранён. Проверьте журнал защиты Windows; не игнорируйте обнаружение угрозы.','Update downloaded and verified · 100%. Setup could not start: its component is missing, inaccessible or blocked by Windows. The package is saved. Check Windows protection history; do not ignore a threat detection.')
          : state.error==='disk-space' ? L('Для обновления не хватает места. Текущая версия продолжает работать.','Not enough disk space. Your current version remains available.')
          : state.error==='checksum' ? L('Проверка обновления не пройдена. Файлы приложения не изменены.','Update verification failed. Application files were not changed.')
          : L('Обновления сейчас недоступны. Проверим при следующем запуске.','Updates are unavailable. We will check on the next launch.');
        if(['cancelled','error'].includes(state.phase)) return;
      }
      setTimeout(poll,state.phase==='installer'?2000:750);
    } catch { /* Offline and shutdown must not interrupt the application. */ }
  }
  fetch('/api/app-update/start',{method:'POST'}).then(response=>{if(response.ok)poll();}).catch(()=>{});
}
