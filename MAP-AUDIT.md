# Аудит карт / Map audit

Проверка: версия **1.12.0**, 14 ноября 2026. Машинный отчёт с временем UTC и ссылкой на источник для каждой карты: [map-audit.json](public/data/map-audit.json). Повторный аудит: `node scripts/audit-map-data.mjs` (требует интернет).

## Что проверено

- 15 вариантов карт в PvP и PvE: **30 представлений, 34 979 меток**.
- Некорректных координат X/Z: **0**; отсутствующих локальных иконок: **0**; пустых названий: **0**. Проверяются исходные записи, включая те, которые отбрасывает безопасный рендерер.
- Все категории сопоставлены с текущим публичным API справочника: `https://www.tarkovhead.com/api/map/<slug>?gameMode=<regular|pve>&locale=ru`. Координаты и названия сравниваются отдельно, по всем точкам категории.
- Исправлены точки появления Маяка по текущему справочнику (RU/EN, PvP/PvE).
- Исправлены маршруты ночного Завода и Эпицентра 21+. Добавлены отсутствовавшие локальные файлы вариантов PvE и английские варианты.
- **714 записей опасностей**, включая миномётные зоны: содержимое совпадает с текущим справочником во всех 30 представлениях. Контуры снайперских зон проходят геометрические тесты. Наведение подсвечивает скрытые зоны и зоны другого этажа в обоих стилях меток.
- Подсказки и карточки показывают имеющиеся ключи, связанные переключатели, предметы, условия и задания. Техническое `BotZone…` отображается как «Зона появления». Условия, которых нет в данных, не выдумываются.

## Что не подтверждено

Новые сезонные точки сверены с целями заданий и иллюстрациями и включены в снимок. У «Ослепить противника» на Таможне исправлены три старые копии камер: в справочнике шесть записей представляли три объекта. При сравнении к источнику применяется то же правило устранения дублей. Все категории совпадают по координатам и названиям в 30 из 30 представлений. Протокол и ссылки: [VERIFICATION.md](VERIFICATION.md).

**Совпадение со справочником не является проверкой в игре.** Точный текущий номер сборки и геометрия опасностей в реальном рейде независимо не подтверждены. Контуры показаны пунктиром; предупреждение в подсказке и карточке прямо сообщает об этом. Контур нельзя использовать как гарантированную безопасную границу.

В 15 представлениях ниже текущий справочник содержит дополнительные точки сезонных заданий Хэллоуина. Часть этих заданий отсутствует в базовом локальном каталоге. Сохранённые прохождения и пользовательский прогресс оставлены на месте; новые связи без полного локального задания не добавлялись. Для таких категорий показывается предупреждение «Расположение этой категории не подтверждено текущим справочником». Остальные категории совпадают с источником по координатам. Доступные сетевые обновления сезонного контента работают отдельно.

| Режим / карта | Меток | Опасностей | Несовпадающие категории |
| --- | ---: | ---: | --- |
| regular / customs | 1417 | 7 | задания / quests |
| regular / factory | 467 | 0 | задания / quests |
| regular / ground-zero-21 | 1076 | 9 | — |
| regular / ground-zero | 992 | 9 | — |
| regular / icebreaker | 193 | 0 | — |
| regular / interchange | 1700 | 25 | — |
| regular / lighthouse | 1854 | 116 | задания / quests |
| regular / night-factory | 478 | 0 | задания / quests |
| regular / reserve | 1794 | 6 | задания / quests |
| regular / shoreline | 1738 | 32 | задания / quests |
| regular / streets-of-tarkov | 3009 | 56 | — |
| regular / terminal | 162 | 12 | — |
| regular / the-lab | 933 | 0 | задания / quests |
| regular / the-labyrinth | 329 | 19 | — |
| regular / woods | 1321 | 66 | задания / quests |
| pve / customs | 1417 | 7 | задания / quests |
| pve / factory | 467 | 0 | задания / quests |
| pve / ground-zero-21 | 1076 | 9 | — |
| pve / ground-zero | 992 | 9 | — |
| pve / icebreaker | 196 | 0 | — |
| pve / interchange | 1700 | 25 | — |
| pve / lighthouse | 1856 | 116 | задания / quests |
| pve / night-factory | 480 | 0 | — |
| pve / reserve | 1794 | 6 | задания / quests |
| pve / shoreline | 1738 | 32 | задания / quests |
| pve / streets-of-tarkov | 3009 | 56 | — |
| pve / terminal | 162 | 12 | — |
| pve / the-lab | 933 | 0 | задания / quests |
| pve / the-labyrinth | 329 | 19 | — |
| pve / woods | 1321 | 66 | задания / quests |

## English

The audit covers 30 map views, 34,933 markers and 714 hazard records. No invalid X/Z positions, missing local icons or empty labels were found. Lighthouse spawn references and distinct Night Factory / Ground Zero 21+ routes were corrected, including missing PvE and English map files.

Hazard data matches the current reference API, but **current in-game boundaries and the exact game build have not been independently verified**. Dashed outlines and tooltips explicitly warn about this. Fifteen views still differ in seasonal quest markers; unknown quest links were not fabricated and existing guides/progress were preserved. The affected categories are labelled unconfirmed. This is a reference audit, not a guarantee of safe movement in a raid.

## Уточнение 1.10.1 / 1.10.1 clarification

На проходе к маяку четыре справочных прямоугольника снайпера в каждом режиме не отрисовываются как зона поражения: их границы оспорены наблюдением игрока у заграждения. Исходные координаты сохранены для аудита, метки предупреждения остаются. Карточка прямо указывает, что «примерно метр за заграждением» — наблюдение игрока, точный порог не подтверждён. Новые координаты заграждения не выдумывались. Это не обозначает скрытый участок как безопасный.

Four reference sniper rectangles at the lighthouse approach in each mode are not shaded as firing boundaries. The raw reference geometry and warning markers remain; the barricade-distance claim is labelled as an unverified player observation, not a measured safe boundary.
