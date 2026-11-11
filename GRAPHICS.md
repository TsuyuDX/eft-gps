# Графика и цветокоррекция / Graphics and colour correction

Откройте **Цветокоррекция** в верхнем меню (или из настроек), выберите локацию и добавьте собственный исходный PNG/JPEG. Можно добавить несколько снимков одной локации; для разных локаций импортируйте их отдельно.

Выберите пресет или настройте семь ползунков. Перетаскивайте разделитель «До / После»; клавиши стрелок работают, когда он в фокусе. Кнопки +/− увеличивают изображение; «По размеру окна» возвращает масштаб 100%. При увеличении изображение можно прокручивать.

Введите название и нажмите «Сохранить новый». Свои пресеты можно переименовывать и удалять, встроенные всегда доступны. «Сбросить к оригиналу» сбрасывает только текущие параметры.

**Это инструмент предпросмотра.** Он не меняет игру, драйвер или системную гамму. Инструкция под изображением помогает вручную подобрать похожий вид в NVIDIA Control Panel и доступных настройках PostFX. У шкал нет точного взаимного соответствия; освещение, монитор, HDR и версия игры влияют на результат.

Скриншоты хранятся в `userdata/graphics-gallery`, настройки — в существующем `userdata/window-settings.json` под отдельным ключом. Эти данные исключены из Git и сохраняются при обновлении. Снимки не отправляются наружу; исходные файлы не перезаписываются. Лимит: 20 снимков, 12 МБ на файл, 160 МБ суммарно. Для скорости предпросмотр уменьшается до 1920 × 1080; оригинал остаётся без изменений. Готовая галерея чужих игровых скриншотов не включена: добавляйте собственные.

## English

Open **Colour correction** from the main navigation or Settings. Choose a location and import your own original PNG/JPEG screenshots. Import different locations separately.

Choose a preset or use the seven sliders. Drag the Before / After divider, or focus it and use arrow keys. +/− zoom the preview; Fit to window restores 100%. Scroll the enlarged preview to pan.

Name your setup and choose Save new. Custom presets can be renamed/deleted; built-ins are always available. Reset to original affects only the current preview values.

**Preview only:** the application does not change the game, driver or system gamma. Follow the manual NVIDIA/PostFX instructions below the preview, adjusting the controls available in your game version. Matching numbers are not equivalent across programs.

Images remain in private `userdata/graphics-gallery`; profiles use a separate key in the existing `userdata/window-settings.json`. Both survive application updates and are excluded from Git. No uploads to external services, no changes to your source images. Limits: 20 screenshots, 12 MB each, 160 MB total. Preview is scaled to fit 1920 × 1080 for performance; originals stay intact. No third-party gameplay gallery is bundled: import your own screenshots.

NVIDIA reference: https://www.nvidia.com/content/Control-Panel-Help/vLatest/en-us/mergedProjects/nvdsp/CS_Adjust_Color_Settings_Advanced.htm
