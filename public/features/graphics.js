import { esc, heading, toast, confirmAction } from "../core/ui.js";
import { language } from "../core/localization.js";
import {
  readWindowSetting,
  writeWindowSetting,
} from "../core/window-settings.js";
import {
  parameters,
  original,
  builtinPresets,
  locations,
  graphicsKey,
  normalizeGraphics,
  normalizeAdjustments,
  filterValues,
} from "../core/graphics-model.js";
const words = {
  "Графика и цветокоррекция": "Graphics and colour correction",
  Яркость: "Brightness",
  Контрастность: "Contrast",
  Насыщенность: "Saturation",
  Гамма: "Gamma",
  Температура: "Temperature",
  Резкость: "Sharpness",
  Интенсивность: "Intensity",
  Оригинал: "Original",
  Светлее: "Brighter",
  Темнее: "Darker",
  "Повышенная видимость": "Visibility",
  "Естественные цвета": "Natural colours",
  Кинематографический: "Cinematic",
  Лес: "Woods",
  Таможня: "Customs",
  Развязка: "Interchange",
  Берег: "Shoreline",
  "Улицы Таркова": "Streets of Tarkov",
  Лаборатория: "The Lab",
  Завод: "Factory",
  Маяк: "Lighthouse",
  Резерв: "Reserve",
  Эпицентр: "Ground Zero",
  "Другая локация": "Other location",
};
const tr = (ru, en) => (language() === "en" ? en || words[ru] || ru : ru);
function loadSettings() {
  try {
    return normalizeGraphics(
      JSON.parse(readWindowSetting(graphicsKey) || "null"),
    );
  } catch {
    return normalizeGraphics(null);
  }
}
export async function renderGraphics(root) {
  const controller = new AbortController(),
    signal = controller.signal;
  let objectUrl = null,
    imageVersion = 0,
    frame = 0,
    zoom = 1,
    selected = null,
    gallery = [],
    settings = loadSettings(),
    selectedPreset = "",
    pending = false;
  const bind = (node, type, handler) =>
    node.addEventListener(type, handler, { signal });
  const cleanup = () => {
    controller.abort();
    cancelAnimationFrame(frame);
    imageVersion++;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
  window.addEventListener("view-changing", cleanup, { once: true, signal });
  root.innerHTML = `<section class="graphics-page" data-no-translate>${heading(tr("Графика и цветокоррекция"), tr("Подберите изображение на своих скриншотах, затем настройте игру вручную.", "Find your preferred image using your screenshots, then adjust the game manually."))}
    <div class="graphics-top"><label>${tr("Локация", "Location")}<select id="graphics-location">${locations.map((x) => `<option value="${esc(x)}">${tr(x)}</option>`).join("")}</select></label><label class="button primary graphics-import">${tr("Добавить скриншоты", "Add screenshots")}<input id="graphics-files" type="file" accept="image/png,image/jpeg" multiple></label><span class="muted small">PNG / JPEG · ${tr("до 12 МБ · до 20 снимков", "up to 12 MB · up to 20 images")}</span></div>
    <p class="muted small">${tr("Используйте свои исходные скриншоты без фильтров. Они хранятся только на этом компьютере и сохраняются при обновлении приложения. Оригиналы не изменяются.", "Use your own original screenshots without filters. They stay on this computer and are preserved through application updates. Originals are never changed.")}</p>
    <div id="graphics-gallery" class="graphics-gallery" aria-label="${tr("Скриншоты", "Screenshots")}"></div>
    <div class="graphics-layout"><section class="graphics-preview-panel"><div class="row wrap graphics-preview-toolbar"><strong id="graphics-image-title">${tr("Предпросмотр", "Preview")}</strong><span class="badge">${tr("Только предпросмотр", "Preview only")}</span><button id="graphics-zoom-out" aria-label="${tr("Уменьшить", "Zoom out")}">−</button><output id="graphics-zoom">100%</output><button id="graphics-zoom-in" aria-label="${tr("Увеличить", "Zoom in")}">+</button><button id="graphics-fit">${tr("По размеру окна", "Fit to window")}</button><button id="graphics-delete" hidden>${tr("Удалить снимок", "Delete image")}</button></div>
    <div class="graphics-preview-scroll"><div class="graphics-compare" id="graphics-compare" hidden><div class="graphics-scene"><img id="graphics-before" alt="${tr("Оригинальный скриншот", "Original screenshot")}" draggable="false"><div id="graphics-after-clip" class="graphics-after"><img id="graphics-after" alt="${tr("Предпросмотр цветокоррекции", "Colour correction preview")}" draggable="false"></div></div><div id="graphics-divider" class="graphics-divider"><span>‹ ›</span></div><span class="graphics-before-label">${tr("До", "Before")}</span><span class="graphics-after-label">${tr("После", "After")}</span><input id="graphics-split" type="range" min="0" max="100" value="50" aria-label="${tr("Сравнение до и после", "Before and after comparison")}"></div><div id="graphics-empty" class="empty">${tr("Добавьте скриншот выбранной локации, чтобы сравнить оригинал и цветокоррекцию.", "Add a screenshot for the selected location to compare the original and your adjustments.")}</div></div><p id="graphics-status" class="muted small" role="status" aria-live="polite"></p>
    <svg class="graphics-filter-defs" aria-hidden="true" width="0" height="0"><defs><filter id="graphics-colour-filter" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feComponentTransfer><feFuncR type="gamma" amplitude="1" exponent="1" offset="0"/><feFuncG type="gamma" amplitude="1" exponent="1" offset="0"/><feFuncB type="gamma" amplitude="1" exponent="1" offset="0"/></feComponentTransfer><feComponentTransfer id="graphics-linear"><feFuncR type="linear" slope="1" intercept="0"/><feFuncG type="linear" slope="1" intercept="0"/><feFuncB type="linear" slope="1" intercept="0"/></feComponentTransfer><feColorMatrix id="graphics-saturation" type="saturate" values="1"/><feColorMatrix id="graphics-temperature" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/><feConvolveMatrix id="graphics-sharpness" order="3" kernelMatrix="0 0 0 0 1 0 0 0 0" preserveAlpha="true" edgeMode="duplicate"/><feComposite id="graphics-intensity" in2="SourceGraphic" operator="arithmetic" k1="0" k2="1" k3="0" k4="0"/></filter></defs></svg></section>
    <aside class="graphics-controls"><label>${tr("Пресет", "Preset")}<select id="graphics-preset"></select></label><div id="graphics-sliders">${parameters.map(([key, label, min, max, step, , unit]) => `<label class="graphics-slider"><span>${tr(label)}<output data-value="${key}"></output></span><input data-adjust="${key}" type="range" min="${min}" max="${max}" step="${step}" aria-label="${tr(label)}" data-unit="${unit}"></label>`).join("")}</div><button id="graphics-reset">${tr("Сбросить к оригиналу", "Reset to original")}</button><label>${tr("Название своего пресета", "Custom preset name")}<input id="graphics-preset-name" maxlength="60" placeholder="${tr("Мой пресет", "My preset")}"></label><div class="row wrap"><button id="graphics-save" class="primary">${tr("Сохранить новый", "Save new")}</button><button id="graphics-rename">${tr("Переименовать", "Rename")}</button><button id="graphics-remove">${tr("Удалить пресет", "Delete preset")}</button></div><p class="muted small">${tr("Сохранённые пресеты доступны на всех локациях. Встроенные пресеты — отправные точки для подбора, а не готовые настройки игры.", "Saved presets work across locations. Built-in presets are starting points for previewing, not game settings.")}</p></aside></div>
    <section class="graphics-guide"><h2>${tr("Как настроить NVIDIA и PostFX", "How to adjust NVIDIA and PostFX")}</h2><p>${tr("В игре и драйвере ничего не меняется автоматически. Предпросмотр помогает выбрать желаемый вид; одинаковые числа в разных программах не дают одинаковый результат.", "Nothing is changed automatically in the game or driver. The preview helps you choose a target look; matching numbers in different programs do not produce matching results.")}</p><ol><li>${tr("Сделайте исходный скриншот в тренировочном рейде с привычными настройками. Добавьте несколько кадров: тёмное помещение, улицу, тень и яркое небо.", "Take an original screenshot in a practice raid with your usual settings. Add several scenes: a dark interior, outdoors, shade and bright sky.")}</li><li>${tr("Выберите пресет, настройте ползунки и сравните «До / После». Проверяйте результат на разных локациях, чтобы светлые области не теряли детали.", "Choose a preset, adjust the sliders and compare Before / After. Check different locations to keep details in bright areas.")}</li><li>${tr("NVIDIA: откройте «Панель управления NVIDIA → Дисплей → Регулировка параметров цвета рабочего стола». Выберите монитор. Небольшими шагами подберите яркость, контрастность, гамму и цифровую интенсивность, ориентируясь на предпросмотр. Сначала запишите исходные значения: изменение затронет весь выбранный монитор.", "NVIDIA: open NVIDIA Control Panel → Display → Adjust desktop colour settings. Select your monitor. Adjust brightness, contrast, gamma and digital vibrance in small steps using the preview as a visual target. Record the original values first: changes affect the entire selected display.")}</li><li>${tr("Escape from Tarkov: откройте настройки игры → PostFX. Используйте доступные в вашей версии параметры яркости, цветокоррекции и резкости. Названия и набор параметров зависят от версии игры. Меняйте один параметр за раз и проверяйте в тренировочном рейде.", "Escape from Tarkov: open game settings → PostFX. Use the brightness, colour grading and sharpening controls available in your version. Names and available controls vary by game version. Change one control at a time and check in a practice raid.")}</li><li>${tr("Сделайте новый скриншот и добавьте его для сравнения. При необходимости скорректируйте значения. Проверяйте FPS, читаемость теней и отсутствие пересвета.", "Take another screenshot and add it to compare. Fine-tune as needed. Check FPS, shadow detail and blown highlights.")}</li></ol><p class="muted small">${tr("Гамма в предпросмотре использует степенную кривую. Температура и интенсивность — параметры предпросмотра; точного соответствия шкалам NVIDIA и PostFX нет. HDR, настройки монитора и освещение сцены также влияют на результат.", "Preview gamma uses a power curve. Temperature and intensity are preview controls with no exact NVIDIA or PostFX equivalent. HDR, monitor settings and scene lighting also affect the result.")}</p><details><summary>${tr("Мои значения предпросмотра", "My preview values")}</summary><pre id="graphics-values"></pre><button id="graphics-copy">${tr("Скопировать значения", "Copy values")}</button></details><p><a href="https://www.nvidia.com/content/Control-Panel-Help/vLatest/en-us/mergedProjects/nvdsp/CS_Adjust_Color_Settings_Advanced.htm" target="_blank" rel="noopener noreferrer">${tr("Справка NVIDIA: параметры цвета", "NVIDIA help: colour settings")} ↗</a></p></section></section>`;
  const $ = (s) => root.querySelector(s);
  const persist = () =>
    writeWindowSetting(graphicsKey, JSON.stringify(settings));
  const status = (text) => ($("#graphics-status").textContent = text);
  function presets() {
    $("#graphics-preset").innerHTML =
      `<option value="">${tr("Пользовательские значения", "Custom values")}</option>` +
      [...builtinPresets, ...settings.presets]
        .map(
          (p) =>
            `<option value="${p.id}">${esc(builtinPresets.includes(p) ? tr(p.name) : p.name)}</option>`,
        )
        .join("");
    $("#graphics-preset").value = selectedPreset;
    const custom = settings.presets.find((p) => p.id === selectedPreset);
    $("#graphics-rename").disabled = !custom;
    $("#graphics-remove").disabled = !custom;
    if (custom) $("#graphics-preset-name").value = custom.name;
  }
  function update() {
    const v = filterValues(settings.values);
    root
      .querySelectorAll(
        "#graphics-colour-filter feComponentTransfer:first-child > *",
      )
      .forEach((x) => x.setAttribute("exponent", v.exponent));
    root.querySelectorAll("#graphics-linear > *").forEach((x) => {
      x.setAttribute("slope", v.slope);
      x.setAttribute("intercept", v.intercept);
    });
    $("#graphics-saturation").setAttribute("values", v.saturation);
    $("#graphics-temperature").setAttribute(
      "values",
      `${v.red} 0 0 0 0 0 1 0 0 0 0 0 ${v.blue} 0 0 0 0 0 1 0`,
    );
    $("#graphics-sharpness").setAttribute("kernelMatrix", v.kernel);
    $("#graphics-intensity").setAttribute("k2", v.intensity);
    $("#graphics-intensity").setAttribute("k3", 1 - v.intensity);
    for (const [key, , , , step, , unit] of parameters) {
      const value = settings.values[key];
      $(`[data-adjust="${key}"]`).value = value;
      $(`[data-value="${key}"]`).textContent =
        (step < 1 ? value.toFixed(2) : value) + unit;
    }
    $("#graphics-values").textContent = parameters
      .map(
        ([key, label, , , , , unit]) =>
          `${tr(label)}: ${settings.values[key]}${unit}`,
      )
      .join("\n");
  }
  function split() {
    const n = Number($("#graphics-split").value);
    $("#graphics-after-clip").style.clipPath = `inset(0 0 0 ${n}%)`;
    $("#graphics-divider").style.left = n + "%";
  }
  function setZoom(value) {
    zoom = Math.max(1, Math.min(3, value));
    $("#graphics-compare").style.width = zoom * 100 + "%";
    $("#graphics-zoom").value = Math.round(zoom * 100) + "%";
  }
  async function select(item) {
    const version = ++imageVersion;
    selected = item;
    $("#graphics-delete").hidden = !item;
    $("#graphics-compare").hidden = true;
    $("#graphics-empty").hidden = false;
    if (!item) {
      status("");
      return;
    }
    status(tr("Подготовка предпросмотра…", "Preparing preview…"));
    try {
      const response = await fetch(`/api/graphics-gallery/${item.id}`, {
        signal,
      });
      if (!response.ok)
        throw Error(tr("Скриншот недоступен", "Screenshot unavailable"));
      const scale = Math.min(1, 1920 / item.width, 1080 / item.height);
      const bitmap = await createImageBitmap(await response.blob(), {
        resizeWidth: Math.max(1, Math.round(item.width * scale)),
        resizeHeight: Math.max(1, Math.round(item.height * scale)),
        resizeQuality: "high",
      });
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      bitmap.close();
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (signal.aborted || version !== imageVersion) return;
      if (!blob)
        throw Error(
          tr("Не удалось открыть изображение", "Could not open image"),
        );
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      $("#graphics-before").src = objectUrl;
      $("#graphics-after").src = objectUrl;
      $("#graphics-compare").style.aspectRatio =
        `${canvas.width} / ${canvas.height}`;
      $("#graphics-compare").hidden = false;
      $("#graphics-empty").hidden = true;
      setZoom(1);
      $("#graphics-image-title").textContent = tr(item.location);
      status(
        tr(
          "Предпросмотр уменьшен до 1920 × 1080 для быстрой работы. Исходный файл сохранён без изменений.",
          "Preview is scaled to fit 1920 × 1080 for smooth adjustment. The original file is unchanged.",
        ),
      );
      drawGallery();
    } catch (e) {
      if (!signal.aborted && version === imageVersion) status(e.message);
    }
  }
  function drawGallery() {
    const list = gallery.filter(
      (x) => x.location === $("#graphics-location").value,
    );
    $("#graphics-gallery").innerHTML =
      list
        .map(
          (x, i) =>
            `<button class="graphics-shot" data-shot="${x.id}" aria-pressed="${selected?.id === x.id}">${tr(x.location)} · ${i + 1}<small>${x.width} × ${x.height}</small></button>`,
        )
        .join("") ||
      `<span class="muted small">${tr("Для этой локации пока нет снимков.", "No screenshots for this location yet.")}</span>`;
  }
  async function reload(id) {
    const response = await fetch("/api/graphics-gallery", { signal });
    if (!response.ok)
      throw Error(tr("Не удалось открыть галерею", "Could not load gallery"));
    gallery = await response.json();
    if (signal.aborted) return;
    drawGallery();
    await select(
      gallery.find((x) => x.id === id) ||
        gallery.find((x) => x.location === $("#graphics-location").value) ||
        null,
    );
  }
  bind($("#graphics-gallery"), "click", (e) => {
    const button = e.target.closest("[data-shot]");
    if (button) void select(gallery.find((x) => x.id === button.dataset.shot));
  });
  bind($("#graphics-location"), "change", () => {
    drawGallery();
    void select(
      gallery.find((x) => x.location === $("#graphics-location").value) || null,
    );
  });
  bind($("#graphics-files"), "change", async (e) => {
    if (pending) return;
    pending = true;
    const input = e.target;
    input.disabled = true;
    const location = $("#graphics-location").value;
    let last;
    try {
      for (const file of [...input.files].slice(0, 20)) {
        if (file.size > 12 * 1024 * 1024)
          throw Error(
            tr(
              "Скриншот должен быть меньше 12 МБ",
              "Screenshot must be smaller than 12 MB",
            ),
          );
        const response = await fetch(
          `/api/graphics-gallery?location=${encodeURIComponent(location)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file,
            signal,
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw Error(
            result.error ||
              tr("Не удалось сохранить снимок", "Could not save image"),
          );
        last = result.id;
      }
      await reload(last);
    } catch (e) {
      if (!signal.aborted) {
        status(e.message);
        await reload(last).catch(() => {});
        status(e.message);
      }
    } finally {
      pending = false;
      input.value = "";
      input.disabled = false;
    }
  });
  bind($("#graphics-delete"), "click", async () => {
    if (!selected) return;
    const item = selected;
    if (
      !(await confirmAction(
        tr("Удалить снимок?", "Delete screenshot?"),
        tr(
          "Будет удалена только копия из галереи EFT GPS. Исходный файл останется на месте.",
          "Only the EFT GPS gallery copy will be removed. Your source file will remain.",
        ),
        tr("Удалить", "Delete"),
      )) ||
      signal.aborted
    )
      return;
    try {
      const response = await fetch(`/api/graphics-gallery/${item.id}`, {
        method: "DELETE",
        signal,
      });
      if (!response.ok)
        throw Error(tr("Не удалось удалить снимок", "Could not delete image"));
      await reload();
    } catch (e) {
      if (!signal.aborted) status(e.message);
    }
  });
  bind($("#graphics-split"), "input", split);
  bind($("#graphics-zoom-in"), "click", () => setZoom(zoom + 0.25));
  bind($("#graphics-zoom-out"), "click", () => setZoom(zoom - 0.25));
  bind($("#graphics-fit"), "click", () => setZoom(1));
  bind($("#graphics-sliders"), "input", (e) => {
    if (!e.target.dataset.adjust) return;
    settings.values = normalizeAdjustments({
      ...settings.values,
      [e.target.dataset.adjust]: Number(e.target.value),
    });
    selectedPreset = "";
    $("#graphics-preset").value = "";
    $("#graphics-rename").disabled = true;
    $("#graphics-remove").disabled = true;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  });
  bind($("#graphics-sliders"), "change", persist);
  bind($("#graphics-preset"), "change", (e) => {
    const p = [...builtinPresets, ...settings.presets].find(
      (p) => p.id === e.target.value,
    );
    selectedPreset = p?.id || "";
    if (p) settings.values = { ...p.values };
    presets();
    update();
    persist();
  });
  bind($("#graphics-reset"), "click", () => {
    settings.values = { ...original };
    selectedPreset = "original";
    presets();
    update();
    persist();
  });
  bind($("#graphics-save"), "click", () => {
    const name = $("#graphics-preset-name").value.trim();
    if (!name) {
      $("#graphics-preset-name").focus();
      return;
    }
    if (settings.presets.length >= 20) {
      toast(
        tr("Можно сохранить до 20 пресетов", "You can save up to 20 presets"),
      );
      return;
    }
    const p = {
      id: "custom-" + crypto.randomUUID(),
      name,
      values: { ...settings.values },
    };
    settings.presets.push(p);
    selectedPreset = p.id;
    presets();
    persist();
    toast(tr("Пресет сохранён", "Preset saved"));
  });
  bind($("#graphics-rename"), "click", () => {
    const p = settings.presets.find((x) => x.id === selectedPreset),
      name = $("#graphics-preset-name").value.trim();
    if (!p || !name) return;
    p.name = name;
    presets();
    persist();
  });
  bind($("#graphics-remove"), "click", () => {
    settings.presets = settings.presets.filter((x) => x.id !== selectedPreset);
    selectedPreset = "";
    presets();
    persist();
  });
  bind($("#graphics-copy"), "click", async () => {
    try {
      await navigator.clipboard.writeText(
        tr(
          "Значения предпросмотра EFT GPS (не шкалы NVIDIA/PostFX)",
          "EFT GPS preview values (not NVIDIA/PostFX scales)",
        ) +
          "\n" +
          $("#graphics-values").textContent,
      );
      toast(tr("Значения скопированы", "Values copied"));
    } catch {
      toast(
        tr(
          "Не удалось скопировать. Выделите значения вручную.",
          "Could not copy. Select the values manually.",
        ),
      );
    }
  });
  bind(window, "settings-save-failed", () =>
    status(
      tr(
        "Не удалось записать настройки на диск. Они остаются в этом окне; повторите сохранение.",
        "Could not save settings to disk. They remain in this window; try saving again.",
      ),
    ),
  );
  presets();
  update();
  split();
  try {
    await reload();
  } catch (e) {
    if (!signal.aborted) status(e.message);
  }
}
