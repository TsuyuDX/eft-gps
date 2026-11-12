// ТЕКСТЫ: Галерея, пресеты и цветокоррекция
// Меняйте только ru/en. Ключ слева — постоянный идентификатор исходной фразы.
// Переменные __V0__ и переносы строк сохраняйте. Пишите обычный текст без HTML.
export const graphics = {
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Гамма: { ru: "Гамма", en: "Gamma" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Температура: { ru: "Температура", en: "Temperature" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Резкость: { ru: "Резкость", en: "Sharpness" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Оригинал: { ru: "Оригинал", en: "Original" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Светлее: { ru: "Светлее", en: "Brighter" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Темнее: { ru: "Темнее", en: "Darker" },
  // Где: public/features/graphics.js, public/core/graphics-model.js, public/features/graphics.js
  "Повышенная видимость": { ru: "Повышенная видимость", en: "Visibility" },
  // Где: public/features/graphics.js, public/core/graphics-model.js, public/features/graphics.js
  "Естественные цвета": { ru: "Естественные цвета", en: "Natural colours" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Кинематографический: { ru: "Кинематографический", en: "Cinematic" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Лес: { ru: "Лес", en: "Woods" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Таможня: { ru: "Таможня", en: "Customs" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Развязка: { ru: "Развязка", en: "Interchange" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Берег: { ru: "Берег", en: "Shoreline" },
  // Где: public/features/graphics.js, public/core/graphics-model.js, public/features/graphics.js
  "Улицы Таркова": { ru: "Улицы Таркова", en: "Streets of Tarkov" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Лаборатория: { ru: "Лаборатория", en: "The Lab" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Завод: { ru: "Завод", en: "Factory" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Маяк: { ru: "Маяк", en: "Lighthouse" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Резерв: { ru: "Резерв", en: "Reserve" },
  // Где: public/features/graphics.js, public/core/graphics-model.js
  Эпицентр: { ru: "Эпицентр", en: "Ground Zero" },
  // Где: public/features/graphics.js, public/core/graphics-model.js, public/features/graphics.js
  "Другая локация": { ru: "Другая локация", en: "Other location" },
  // Где: public/features/graphics.js
  "Подберите изображение на своих скриншотах, затем настройте игру вручную.": {
    ru: "Подберите изображение на своих скриншотах, затем настройте игру вручную.",
    en: "Find your preferred image using your screenshots, then adjust the game manually.",
  },
  // Где: public/features/graphics.js
  Локация: { ru: "Локация", en: "Location" },
  // Где: public/features/graphics.js
  "Добавить скриншоты": { ru: "Добавить скриншоты", en: "Add screenshots" },
  // Где: public/features/graphics.js
  "до 12 МБ · до 20 снимков": {
    ru: "до 12 МБ · до 20 снимков",
    en: "up to 12 MB · up to 20 images",
  },
  // Где: public/features/graphics.js
  "Используйте свои исходные скриншоты без фильтров. Они хранятся только на этом компьютере и сохраняются при обновлении приложения. Оригиналы не изменяются.":
    {
      ru: "Используйте свои исходные скриншоты без фильтров. Они хранятся только на этом компьютере и сохраняются при обновлении приложения. Оригиналы не изменяются.",
      en: "Use your own original screenshots without filters. They stay on this computer and are preserved through application updates. Originals are never changed.",
    },
  // Где: public/features/graphics.js
  Скриншоты: { ru: "Скриншоты", en: "Screenshots" },
  // Где: public/features/graphics.js
  Предпросмотр: { ru: "Предпросмотр", en: "Preview" },
  // Где: public/features/graphics.js
  "Только предпросмотр": { ru: "Только предпросмотр", en: "Preview only" },
  // Где: public/features/graphics.js
  "По размеру окна": { ru: "По размеру окна", en: "Fit to window" },
  // Где: public/features/graphics.js
  "Удалить снимок": { ru: "Удалить снимок", en: "Delete image" },
  // Где: public/features/graphics.js
  "Оригинальный скриншот": {
    ru: "Оригинальный скриншот",
    en: "Original screenshot",
  },
  // Где: public/features/graphics.js
  "Предпросмотр цветокоррекции": {
    ru: "Предпросмотр цветокоррекции",
    en: "Colour correction preview",
  },
  // Где: public/features/graphics.js
  "Сравнение до и после": {
    ru: "Сравнение до и после",
    en: "Before and after comparison",
  },
  // Где: public/features/graphics.js
  "Добавьте скриншот выбранной локации, чтобы сравнить оригинал и цветокоррекцию.":
    {
      ru: "Добавьте скриншот выбранной локации, чтобы сравнить оригинал и цветокоррекцию.",
      en: "Add a screenshot for the selected location to compare the original and your adjustments.",
    },
  // Где: public/features/graphics.js
  Пресет: { ru: "Пресет", en: "Preset" },
  // Где: public/features/graphics.js
  "Сбросить к оригиналу": {
    ru: "Сбросить к оригиналу",
    en: "Reset to original",
  },
  // Где: public/features/graphics.js
  "Название своего пресета": {
    ru: "Название своего пресета",
    en: "Custom preset name",
  },
  // Где: public/features/graphics.js
  "Мой пресет": { ru: "Мой пресет", en: "My preset" },
  // Где: public/features/graphics.js
  "Сохранить новый": { ru: "Сохранить новый", en: "Save new" },
  // Где: public/features/graphics.js
  Переименовать: { ru: "Переименовать", en: "Rename" },
  // Где: public/features/graphics.js
  "Удалить пресет": { ru: "Удалить пресет", en: "Delete preset" },
  // Где: public/features/graphics.js
  "Сохранённые пресеты доступны на всех локациях. Встроенные пресеты — отправные точки для подбора, а не готовые настройки игры.":
    {
      ru: "Сохранённые пресеты доступны на всех локациях. Встроенные пресеты — отправные точки для подбора, а не готовые настройки игры.",
      en: "Saved presets work across locations. Built-in presets are starting points for previewing, not game settings.",
    },
  // Где: public/features/graphics.js
  "Как настроить NVIDIA и PostFX": {
    ru: "Как настроить NVIDIA и PostFX",
    en: "How to adjust NVIDIA and PostFX",
  },
  // Где: public/features/graphics.js
  "В игре и драйвере ничего не меняется автоматически. Предпросмотр помогает выбрать желаемый вид; одинаковые числа в разных программах не дают одинаковый результат.":
    {
      ru: "В игре и драйвере ничего не меняется автоматически. Предпросмотр помогает выбрать желаемый вид; одинаковые числа в разных программах не дают одинаковый результат.",
      en: "Nothing is changed automatically in the game or driver. The preview helps you choose a target look; matching numbers in different programs do not produce matching results.",
    },
  // Где: public/features/graphics.js
  "Сделайте исходный скриншот в тренировочном рейде с привычными настройками. Добавьте несколько кадров: тёмное помещение, улицу, тень и яркое небо.":
    {
      ru: "Сделайте исходный скриншот в тренировочном рейде с привычными настройками. Добавьте несколько кадров: тёмное помещение, улицу, тень и яркое небо.",
      en: "Take an original screenshot in a practice raid with your usual settings. Add several scenes: a dark interior, outdoors, shade and bright sky.",
    },
  // Где: public/features/graphics.js
  "Выберите пресет, настройте ползунки и сравните «До / После». Проверяйте результат на разных локациях, чтобы светлые области не теряли детали.":
    {
      ru: "Выберите пресет, настройте ползунки и сравните «До / После». Проверяйте результат на разных локациях, чтобы светлые области не теряли детали.",
      en: "Choose a preset, adjust the sliders and compare Before / After. Check different locations to keep details in bright areas.",
    },
  // Где: public/features/graphics.js
  "NVIDIA: откройте «Панель управления NVIDIA → Дисплей → Регулировка параметров цвета рабочего стола». Выберите монитор. Небольшими шагами подберите яркость, контрастность, гамму и цифровую интенсивность, ориентируясь на предпросмотр. Сначала запишите исходные значения: изменение затронет весь выбранный монитор.":
    {
      ru: "NVIDIA: откройте «Панель управления NVIDIA → Дисплей → Регулировка параметров цвета рабочего стола». Выберите монитор. Небольшими шагами подберите яркость, контрастность, гамму и цифровую интенсивность, ориентируясь на предпросмотр. Сначала запишите исходные значения: изменение затронет весь выбранный монитор.",
      en: "NVIDIA: open NVIDIA Control Panel → Display → Adjust desktop colour settings. Select your monitor. Adjust brightness, contrast, gamma and digital vibrance in small steps using the preview as a visual target. Record the original values first: changes affect the entire selected display.",
    },
  // Где: public/features/graphics.js
  "Escape from Tarkov: откройте настройки игры → PostFX. Используйте доступные в вашей версии параметры яркости, цветокоррекции и резкости. Названия и набор параметров зависят от версии игры. Меняйте один параметр за раз и проверяйте в тренировочном рейде.":
    {
      ru: "Escape from Tarkov: откройте настройки игры → PostFX. Используйте доступные в вашей версии параметры яркости, цветокоррекции и резкости. Названия и набор параметров зависят от версии игры. Меняйте один параметр за раз и проверяйте в тренировочном рейде.",
      en: "Escape from Tarkov: open game settings → PostFX. Use the brightness, colour grading and sharpening controls available in your version. Names and available controls vary by game version. Change one control at a time and check in a practice raid.",
    },
  // Где: public/features/graphics.js
  "Сделайте новый скриншот и добавьте его для сравнения. При необходимости скорректируйте значения. Проверяйте FPS, читаемость теней и отсутствие пересвета.":
    {
      ru: "Сделайте новый скриншот и добавьте его для сравнения. При необходимости скорректируйте значения. Проверяйте FPS, читаемость теней и отсутствие пересвета.",
      en: "Take another screenshot and add it to compare. Fine-tune as needed. Check FPS, shadow detail and blown highlights.",
    },
  // Где: public/features/graphics.js
  "Гамма в предпросмотре использует степенную кривую. Температура и интенсивность — параметры предпросмотра; точного соответствия шкалам NVIDIA и PostFX нет. HDR, настройки монитора и освещение сцены также влияют на результат.":
    {
      ru: "Гамма в предпросмотре использует степенную кривую. Температура и интенсивность — параметры предпросмотра; точного соответствия шкалам NVIDIA и PostFX нет. HDR, настройки монитора и освещение сцены также влияют на результат.",
      en: "Preview gamma uses a power curve. Temperature and intensity are preview controls with no exact NVIDIA or PostFX equivalent. HDR, monitor settings and scene lighting also affect the result.",
    },
  // Где: public/features/graphics.js
  "Мои значения предпросмотра": {
    ru: "Мои значения предпросмотра",
    en: "My preview values",
  },
  // Где: public/features/graphics.js
  "Скопировать значения": { ru: "Скопировать значения", en: "Copy values" },
  // Где: public/features/graphics.js
  "Справка NVIDIA: параметры цвета": {
    ru: "Справка NVIDIA: параметры цвета",
    en: "NVIDIA help: colour settings",
  },
  // Где: public/features/graphics.js
  "Пользовательские значения": {
    ru: "Пользовательские значения",
    en: "Custom values",
  },
  // Где: public/features/graphics.js
  "Подготовка предпросмотра…": {
    ru: "Подготовка предпросмотра…",
    en: "Preparing preview…",
  },
  // Где: public/features/graphics.js
  "Скриншот недоступен": {
    ru: "Скриншот недоступен",
    en: "Screenshot unavailable",
  },
  // Где: public/features/graphics.js
  "Не удалось открыть изображение": {
    ru: "Не удалось открыть изображение",
    en: "Could not open image",
  },
  // Где: public/features/graphics.js, public/features/graphics.js
  "Предпросмотр уменьшен до 1920 × 1080 для быстрой работы. Исходный файл сохранён без изменений.":
    {
      ru: "Предпросмотр уменьшен до 1920 × 1080 для быстрой работы. Исходный файл сохранён без изменений.",
      en: "Preview is scaled to fit 1920 × 1080 for smooth adjustment. The original file is unchanged.",
    },
  // Где: public/features/graphics.js
  "Для этой локации пока нет снимков.": {
    ru: "Для этой локации пока нет снимков.",
    en: "No screenshots for this location yet.",
  },
  // Где: public/features/graphics.js
  "Не удалось открыть галерею": {
    ru: "Не удалось открыть галерею",
    en: "Could not load gallery",
  },
  // Где: public/features/graphics.js, public/features/graphics.js
  "Скриншот должен быть меньше 12 МБ": {
    ru: "Скриншот должен быть меньше 12 МБ",
    en: "Screenshot must be smaller than 12 MB",
  },
  // Где: public/features/graphics.js
  "Не удалось сохранить снимок": {
    ru: "Не удалось сохранить снимок",
    en: "Could not save image",
  },
  // Где: public/features/graphics.js
  "Удалить снимок?": { ru: "Удалить снимок?", en: "Delete screenshot?" },
  // Где: public/features/graphics.js, public/features/graphics.js
  "Будет удалена только копия из галереи EFT GPS. Исходный файл останется на месте.":
    {
      ru: "Будет удалена только копия из галереи EFT GPS. Исходный файл останется на месте.",
      en: "Only the EFT GPS gallery copy will be removed. Your source file will remain.",
    },
  // Где: public/features/graphics.js
  "Не удалось удалить снимок": {
    ru: "Не удалось удалить снимок",
    en: "Could not delete image",
  },
  // Где: public/features/graphics.js
  "Можно сохранить до 20 пресетов": {
    ru: "Можно сохранить до 20 пресетов",
    en: "You can save up to 20 presets",
  },
  // Где: public/features/graphics.js
  "Пресет сохранён": { ru: "Пресет сохранён", en: "Preset saved" },
  // Где: public/features/graphics.js, public/features/graphics.js
  "Значения предпросмотра EFT GPS (не шкалы NVIDIA/PostFX)": {
    ru: "Параметры предпросмотра EFT GPS. Шкалы NVIDIA и PostFX отличаются.",
    en: "EFT GPS preview values (not NVIDIA/PostFX scales)",
  },
  // Где: public/features/graphics.js
  "Значения скопированы": { ru: "Значения скопированы", en: "Values copied" },
  // Где: public/features/graphics.js, public/features/graphics.js
  "Не удалось скопировать. Выделите значения вручную.": {
    ru: "Не удалось скопировать. Выделите значения вручную.",
    en: "Could not copy. Select the values manually.",
  },
  // Где: public/features/graphics.js, public/features/graphics.js
  "Не удалось записать настройки на диск. Они остаются в этом окне; повторите сохранение.":
    {
      ru: "Не удалось записать настройки на диск. Они остаются в этом окне; повторите сохранение.",
      en: "Could not save settings to disk. They remain in this window; try saving again.",
    },
};
