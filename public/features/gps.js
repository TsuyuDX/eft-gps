import { db } from "../core/data.js";
import { gpsRequest, pollGps, gpsState } from "../core/gps-client.js";
import { heading, esc, toast } from "../core/ui.js";
export async function renderGps(root) {
  const initial = await pollGps();
  if (!initial) {
    root.innerHTML =
      heading("GPS") +
      '<div class="notice">Перезапустите Tarkov Offline.exe, чтобы включить обновлённую локальную службу GPS.</div>';
    return;
  }
  const c = initial.config;
  root.innerHTML =
    heading(
      "GPS в рейде",
      "Координаты из внутриигровых скриншотов · обработка полностью на компьютере",
    ) +
    `<div class="gps-layout"><section class="panel"><h2>Подключение к игре</h2><form id="gps-form"><label class="check"><input id="gps-enabled" type="checkbox" ${c.enabled ? "checked" : ""}> Читать новые внутриигровые скриншоты</label><label class="gps-field">Папка скриншотов<div class="row"><input id="gps-folder" value="${esc(c.screenshotsPath)}" required placeholder="C:\\Users\\…\\Documents\\Escape From Tarkov\\Screenshots"><button type="button" data-pick="gps-folder">Выбрать…</button></div></label><label class="gps-field">Папка Logs игры · необязательно<div class="row"><input id="gps-logs" value="${esc(c.logsPath)}" placeholder="Папка установленной игры\\Logs"><button type="button" data-pick="gps-logs">Выбрать…</button></div></label><p class="small muted">Логи определяют карту и начало/конец рейда. Без логов выберите карту и подтвердите начало рейда вручную.</p><label class="gps-field">Карта при ручном выборе<select id="gps-map">${db.maps.map((m) => `<option value="${m.normalizedName}" ${m.normalizedName === c.map ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label><div class="gps-options"><label>Интервал, секунд<input id="gps-interval" type="number" min="1" max="30" step="1" value="${c.interval}"></label><label>Клавиша скриншота в игре<select id="gps-key">${["PrintScreen", "F12", "F11", "Insert"].map((k) => `<option ${c.key === k ? "selected" : ""}>${k}</option>`).join("")}</select></label></div><label class="check"><input id="gps-auto-map" type="checkbox" ${c.autoMap ? "checked" : ""}> Открывать карту при первом определении позиции</label><label class="check"><input id="gps-auto-floor" type="checkbox" ${c.autoFloor ? "checked" : ""}> Выбирать этаж по высоте персонажа</label><label class="check"><input id="gps-follow" type="checkbox" ${c.follow ? "checked" : ""}> Держать мою метку в центре карты</label><button class="primary" type="submit">Сохранить настройки GPS</button></form></section><section><div class="panel"><h2>Автообновление</h2><div id="gps-status" aria-live="polite"></div><label class="check"><input type="checkbox" id="gps-manual-raid"> Подтверждаю, что я уже в рейде</label><p class="small muted">Нужно только если логи не определили рейд. Если выбранная клавиша занята другим действием, сначала назначьте её на скриншот в настройках игры.</p><div class="row wrap"><button id="gps-start" class="primary">Начать автосъёмку</button><button id="gps-stop">Остановить</button><a id="gps-open-map" class="button" href="#/map/${db.mode}/${initial.map}">Моя карта →</a></div><p class="small muted">Автосъёмка нажимает только выбранную клавишу и только при активном окне EscapeFromTarkov. Она выключена при каждом запуске приложения. Работу нажатий в вашем клиенте необходимо проверить в рейде.</p></div><div class="panel"><h2>Что будет видно</h2><p>Ваша позиция, направление взгляда, высота и время последнего обновления. Между скриншотами сохраняется последняя измеренная точка.</p><p class="muted">Чем короче интервал, тем больше скриншотов создаёт игра. Приложение не удаляет их. Положение других игроков, Диких и боссов не считывается.</p><p class="small muted">Можно пользоваться и без автосъёмки: самостоятельно нажимайте клавишу скриншота в игре.</p></div></section></div>`;
  const controller = new AbortController();
  window.addEventListener("view-changing", () => controller.abort(), {
    once: true,
  });
  function update(s) {
    const box = root.querySelector("#gps-status");
    if (!box) return;
    const age = s.fix
      ? Math.max(0, Math.floor((Date.now() - s.fix.updatedAt) / 1000))
      : null;
    const status =
      {
        off: "Выключена",
        waiting: "Ожидание окна игры",
        paused: "Пауза: окно игры не активно",
        capturing: "Клавиша отправляется в игру",
        "input-blocked": "Windows не приняла нажатие",
      }[s.captureStatus] || s.captureStatus;
    box.innerHTML = `<dl class="gps-readout"><div><dt>Папка скриншотов</dt><dd>${s.folderExists ? "Найдена" : "Не найдена"}</dd></div><div><dt>Состояние рейда</dt><dd>${{ unknown: "Не определено", active: "В рейде", loading: "Загрузка", ended: "Рейд завершён" }[s.raid] || s.raid}</dd></div><div><dt>Автосъёмка</dt><dd>${esc(status)}</dd></div><div><dt>Последняя позиция</dt><dd>${s.fix ? `${age} сек. назад` : "Ещё не получена"}</dd></div>${s.fix ? `<div><dt>Координаты X / Y / Z</dt><dd>${s.fix.position.x.toFixed(2)} / ${s.fix.position.y.toFixed(2)} / ${s.fix.position.z.toFixed(2)}</dd></div><div><dt>Направление</dt><dd>${Math.round(s.fix.rotation)}°</dd></div>` : ""}</dl>${s.message ? `<p class="notice">${esc(s.message)}</p>` : ""}${s.auto && !s.fix ? '<p class="notice">Пока нет координат. Проверьте клавишу скриншота и путь к папке: отправка нажатия сама по себе не подтверждает сохранение файла игрой.</p>' : ""}`;
    root.querySelector("#gps-start").disabled =
      s.auto || !s.config.enabled || !s.folderExists || !s.helperExists;
    root.querySelector("#gps-stop").disabled = !s.auto;
    root.querySelector("#gps-open-map").href = "#/map/" + db.mode + "/" + s.map;
  }
  update(initial);
  window.addEventListener("gps-update", (e) => update(e.detail), {
    signal: controller.signal,
  });
  root.querySelectorAll("[data-pick]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          b.disabled = true;
          const result = await gpsRequest("pick-folder", {});
          if (result.path)
            root.querySelector("#" + b.dataset.pick).value = result.path;
        } catch (e) {
          toast(e.message);
        } finally {
          b.disabled = false;
        }
      }),
  );
  root.querySelector("#gps-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const s = await gpsRequest("settings", {
        enabled: root.querySelector("#gps-enabled").checked,
        screenshotsPath: root.querySelector("#gps-folder").value,
        logsPath: root.querySelector("#gps-logs").value,
        map: root.querySelector("#gps-map").value,
        interval: Number(root.querySelector("#gps-interval").value),
        key: root.querySelector("#gps-key").value,
        autoMap: root.querySelector("#gps-auto-map").checked,
        autoFloor: root.querySelector("#gps-auto-floor").checked,
        follow: root.querySelector("#gps-follow").checked,
      });
      update(s);
      toast(
        "Настройки GPS сохранены. Автосъёмка запускается отдельной кнопкой.",
      );
    } catch (e) {
      toast(e.message);
    }
  };
  root.querySelector("#gps-start").onclick = async () => {
    try {
      update(
        await gpsRequest("auto", {
          enabled: true,
          manualRaid: root.querySelector("#gps-manual-raid").checked,
        }),
      );
    } catch (e) {
      toast(e.message);
    }
  };
  root.querySelector("#gps-stop").onclick = async () => {
    try {
      update(await gpsRequest("auto", { enabled: false }));
    } catch (e) {
      toast(e.message);
    }
  };
}
