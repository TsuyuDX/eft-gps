import { textPair as L } from "./localization.js";
import { readWindowSetting, writeWindowSetting } from "./window-settings.js";
import { normalizeOverlaySettings, overlayDefaults, overlayHotkeys, overlayPositions } from "./overlay-settings.js";
import { db } from "./data.js";
import { esc } from "./ui.js";
import { uiIcon } from "./icons.js";
const key = "tarkov-overlay-v1";
function preference() {
  try { const value=JSON.parse(readWindowSetting(key)); return {enabled:value?.enabled===true,settings:normalizeOverlaySettings(value?.settings)}; }
  catch { return {enabled:false,settings:{...overlayDefaults}}; }
}
export const overlayEnabled = () => preference().enabled;
let transition = Promise.resolve();
export function setOverlayEnabled(enabled, settings = preference().settings) {
  const value={enabled,settings:normalizeOverlaySettings(settings)};
  writeWindowSetting(key,JSON.stringify(value));
  transition=transition.catch(()=>{}).then(async()=>{
    const response=await fetch("/api/overlay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value),signal:AbortSignal.timeout(10000)});
    const state=await response.json();
    if(!response.ok)throw Error(state.error||"overlay-start-failed");
    window.chrome?.webview?.postMessage("overlay-refresh");
    return state;
  });
  return transition;
}
export async function initializeOverlay() {
  if(overlayEnabled())try{await setOverlayEnabled(true);}catch{window.dispatchEvent(new Event("overlay-unavailable"));}
}
export function renderOverlayControl(root) {
  const pref=preference(),controller=new AbortController();
  let settings=pref.settings,enabled=pref.enabled,timer,saveTimer,dirty=false,closed=false;
  root.classList.add("overlay-settings");root.dataset.noTranslate="";
  const positionNames={center:L("По центру","Centre"),"top-left":L("Слева вверху","Top left"),"top-right":L("Справа вверху","Top right"),"bottom-left":L("Слева внизу","Bottom left"),"bottom-right":L("Справа внизу","Bottom right")};
  const options=(values,current)=>values.map(x=>`<option value="${esc(x)}" ${x===current?"selected":""}>${esc(positionNames[x]||x)}</option>`).join("");
  root.innerHTML=`<div class="overlay-intro"><div class="overlay-intro-icon">${uiIcon("map",30)}</div><div><div class="overlay-eyebrow">OVERLAY <span>BETA</span></div><h3>${L("Карта поверх игры","In-game map overlay")}</h3><p>${L("Встроено в EFT GPS. Покажите карту горячей клавишей, не выходя из рейда.","Built into EFT GPS. Show the map with a hotkey without leaving your raid.")}</p></div><label class="overlay-switch"><input type="checkbox" data-overlay-enabled aria-label="${L("Включить Overlay","Enable Overlay")}" ${enabled?"checked":""}><span></span></label></div>
  <div class="overlay-state" data-overlay-state role="status" aria-live="polite"><i></i><span data-overlay-status></span></div>
  <div class="overlay-layout-buttons"><button type="button" data-overlay-layout="map">${uiIcon("map",20)}<span>${L("Большая карта","Large map")}<small>${L("Для проверки маршрута","Check your route")}</small></span></button><button type="button" data-overlay-layout="mini">${uiIcon("locate",20)}<span>${L("Компактная карта","Compact map")}<small>${L("В углу экрана","In a screen corner")}</small></span></button></div>
  <div class="overlay-editor"><div class="overlay-preview" aria-label="${L("Предпросмотр расположения Overlay","Overlay position preview")}"><span class="overlay-preview-screen">${L("Игровой экран","Game screen")}</span><div class="overlay-preview-card"><strong>⌖ EFT GPS</strong><div class="overlay-preview-roads"></div><span>▲</span></div><small>${L("Схема расположения","Position preview")}</small></div><div class="overlay-fields"><label>${L("Горячая клавиша","Hotkey")}<select data-overlay-setting="hotkey">${options(overlayHotkeys,settings.hotkey)}</select></label><label>${L("Положение на экране","Screen position")}<select data-overlay-setting="position">${options(overlayPositions,settings.position)}</select></label><label class="overlay-slider"><span>${L("Непрозрачность","Opacity")}<output data-overlay-output="opacity"></output></span><input data-overlay-setting="opacity" type="range" min="35" max="95" value="${settings.opacity}"></label><label class="overlay-slider"><span>${L("Размер карты","Map size")}<output data-overlay-output="size"></output></span><input data-overlay-setting="size" type="range" min="25" max="95" value="${settings.size}"></label></div></div>
  <div class="overlay-field-grid"><label>${L("Карта при ручном выборе","Manual map")}<select data-overlay-setting="map">${db.maps.map(map=>{const slug=map.routeSlug||map.normalizedName;return `<option value="${esc(slug)}" ${settings.map===slug?"selected":""}>${esc(map.name)}</option>`;}).join("")}</select></label><label>${L("Режим карты","Map mode")}<select data-overlay-setting="mode"><option value="regular" ${settings.mode==="regular"?"selected":""}>PvP</option><option value="pve" ${settings.mode==="pve"?"selected":""}>PvE</option></select></label><label>${L("Обновление изображения","Image refresh")}<select data-overlay-setting="refreshMs"><option value="500" ${settings.refreshMs===500?"selected":""}>${L("Каждые 0,5 с","Every 0.5 s")}</option><option value="1000" ${settings.refreshMs===1000?"selected":""}>${L("Каждую секунду","Every second")}</option><option value="2000" ${settings.refreshMs===2000?"selected":""}>${L("Каждые 2 с · экономнее","Every 2 s · lower load")}</option></select></label></div>
  <div class="overlay-checks">${[["autoMap",L("Выбирать карту по GPS","Choose map using GPS")],["follow",L("Держать мою позицию в центре","Keep my position centred")],["labels",L("Показывать названия выходов","Show extract labels")]].map(([setting,label])=>`<label class="check"><input type="checkbox" data-overlay-setting="${setting}" ${settings[setting]?"checked":""}>${label}</label>`).join("")}</div>
  <div class="row wrap overlay-actions"><button type="button" class="primary" data-overlay-toggle disabled>${L("Показать / скрыть карту","Show / hide map")}</button><button type="button" data-overlay-reset>${L("Сбросить настройки Overlay","Reset Overlay settings")}</button><small class="muted" data-overlay-save role="status"></small></div>
  <p class="overlay-note">${L("Используйте оконный режим без рамки. Карта пропускает нажатия мыши в игру. Когда Overlay выключен, его окно и модуль отображения закрыты. Частота обновления изображения не меняет интервал GPS-скриншотов.","Use borderless windowed mode. Mouse input passes through the map to the game. Disabling Overlay closes its window and rendering component. Image refresh does not change the GPS screenshot interval.")}</p>`;
  const $=selector=>root.querySelector(selector),toggle=$("[data-overlay-enabled]"),status=$("[data-overlay-status]"),saveStatus=$("[data-overlay-save]");
  const preview=()=>{
    const card=$(".overlay-preview-card");card.dataset.position=settings.position;card.style.setProperty("--overlay-size",settings.size+"%");card.style.opacity=settings.opacity/100;
    for(const setting of ["opacity","size"])$(`[data-overlay-output="${setting}"]`).textContent=settings[setting]+"%";
    $("[data-overlay-setting=map]").disabled=settings.autoMap;
  };
  function show(state){
    if(closed)return;
    const ready=state?.running;
    $("[data-overlay-state]").classList.toggle("is-running",ready);
    $("[data-overlay-toggle]").disabled=!enabled||!ready||!window.chrome?.webview;
    status.textContent=!enabled?L("Overlay выключен","Overlay is off"):state?.error==="hotkey-in-use"?L("Горячая клавиша занята. Выберите другую комбинацию.","Hotkey is in use. Choose another combination."):state?.error?L("Не удалось подготовить карту. Выключите Overlay и повторите запуск.","Could not prepare the map. Disable Overlay and try again."):ready?L("Готово. Нажмите ","Ready. Press ")+settings.hotkey:!state?.attached?L("Откройте EFT GPS.exe: Overlay работает внутри окна приложения.","Open EFT GPS.exe: Overlay runs inside the desktop application."):L("Подготавливаем карту…","Preparing map…");
  }
  async function flush(){
    clearTimeout(saveTimer);if(!dirty)return;dirty=false;
    saveStatus.textContent=L("Сохраняем…","Saving…");
    try{const state=await setOverlayEnabled(enabled,settings);if(!closed){show(state);saveStatus.textContent=L("Сохранено","Saved");}}
    catch{if(!closed)saveStatus.textContent=L("Настройки сохранены; нет связи с модулем Overlay.","Settings saved; the Overlay component is unavailable.");}
  }
  const changed=()=>{preview();dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(flush,250);};
  root.querySelectorAll("[data-overlay-setting]").forEach(input=>{
    const update=()=>{const name=input.dataset.overlaySetting;settings=normalizeOverlaySettings({...settings,[name]:input.type==="checkbox"?input.checked:["opacity","size","refreshMs"].includes(name)?Number(input.value):input.value});changed();};
    input.addEventListener(input.type==="range"?"input":"change",update,{signal:controller.signal});
  });
  toggle.onchange=async()=>{enabled=toggle.checked;dirty=true;toggle.disabled=true;await flush();if(!closed)toggle.disabled=false;};
  root.querySelectorAll("[data-overlay-layout]").forEach(button=>button.onclick=()=>{
    settings={...settings,size:button.dataset.overlayLayout==="mini"?34:78,position:button.dataset.overlayLayout==="mini"?"bottom-right":"center"};
    $("[data-overlay-setting=size]").value=settings.size;$("[data-overlay-setting=position]").value=settings.position;changed();
  });
  $("[data-overlay-reset]").onclick=()=>{settings={...overlayDefaults};dirty=true;cleanup();renderOverlayControl(root);};
  $("[data-overlay-toggle]").onclick=()=>window.chrome?.webview?.postMessage("overlay-toggle");
  const cleanup=()=>{void flush();closed=true;clearTimeout(timer);clearTimeout(saveTimer);controller.abort();};
  document.querySelector("#modal")?.addEventListener("close",cleanup,{once:true,signal:controller.signal});
  document.querySelector("#modal")?.addEventListener("modal-replaced",cleanup,{once:true,signal:controller.signal});
  async function poll(){
    if(!root.isConnected||closed){cleanup();return;}
    try{const response=await fetch("/api/overlay",{signal:controller.signal});if(response.ok)show(await response.json());}catch{}
    if(!closed)timer=setTimeout(poll,1500);
  }
  preview();show();void poll();
}
