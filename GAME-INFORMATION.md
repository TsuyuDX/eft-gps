# События, сезоны и промокоды / Game information

## Что работает

- Главная показывает сезон отдельно от активных событий. Зелёная карточка события появляется только при подтверждённой активности. Когда время подтверждения истекает, карточка исчезает; при подтверждённом завершении запись становится архивной. Отсутствие свежего подтверждения не означает, что событие точно закончилось в игре.
- Вкладка «События» открывает актуальность, награды и источники; сохранённые старые события остаются в архиве. Есть переходы в существующие прохождения с изображениями и точками карты.
- «Промокоды» содержит постоянные, временные/с неизвестным сроком и архив, фильтры PvP / PvE / PvP Season и отдельный фильтр неподтверждённых режимов, копирование кода и ссылку на источник. Публикация не считается проверкой активации.
- Новые новости попадают в обычную ленту и общий поиск. Заголовки и короткие выдержки сохраняют язык источника; приложение не выдумывает автоматический перевод или полное прохождение. Изображение интерфейса EFT GPS помечается как иллюстрация, а не кадр события. Новые чужие изображения автоматически не скачиваются.

## Автоматическое получение

Задача GitHub Actions `.github/workflows/game-information.yml` запускается раз в час (расписание GitHub может задерживаться) и вручную. Используется разреженная загрузка только сборщика, его модели, начальных данных и зависимостей — карты и Windows runtime для задачи не загружаются.

Подключены:

1. Steam News API, приложение 3932890, только `steam_community_announcements`. Ленты сторонних СМИ отбрасываются.
2. Публичная HTML-лента проверенного канала `escapefromtarkovEN` в Telegram. Закрытые сообщения, аккаунты и обход ограничений не используются.
3. Публичная RSS-лента официального YouTube-канала Battlestate `UC5QGploHhl9_XaxDiHZKamg`. Чужой ID канала отклоняется. Это метаданные публикаций; распознавание речи из видео/стримов не выполняется.

Сборщик нормализует записи, удаляет повторения ID, хранит первоисточник, категорию, режимы только при явном подтверждении, дату публикации и статус проверки. Пустые записи и новости только об Arena исключаются. Кандидаты событий/промокодов остаются неподтверждёнными. Знакомые сущности обновляются только по узким явным формулировкам официального канала: подтверждение текущего Halloween, сообщение о его завершении, дата окончания Kord Breach. Подтверждение текущей активности живёт 48 часов — это срок свежести проверки, а не выдуманная дата конца события. Для новых событий условия/награды/прохождение требуют редакторской проверки.

Результат публикуется только в `feed.json` ветки **content-feed**. Исходники main и его проверенный снимок не меняются каждый час. Авторизация задачи — временный `github.token`, без новых пользовательских ключей или паролей. Нет force push или бесконечных повторных запросов. Лента приложения: `https://raw.githubusercontent.com/TsuyuDX/eft-gps/content-feed/feed.json`.

Приложение получает этот небольшой JSON при запуске и раз в час; в настройках источников доступна ручная проверка с ограничением частоты. Кэш `userdata/game-info/feed.json` сохраняется атомарно. При ошибке связи остаются прежние сведения с отметкой состояния; файлы пользователя и установки не заменяются.

## Что не подключено

- Основной сайт EFT: при проверке отвечает HTTP 403; ограничение не обходится.
- Форум: разрешённая структурированная лента официальных сообщений не подтверждена. Публикации пользователей форума не объявляются официальными.
- Twitch: не подключены Client ID и OAuth-доступ Helix; чтение трансляций и распознавание речи не включены.
- TikTok: нет подключённого разрешённого API чтения публикаций.
- Reddit: нет подключённого доступа к Data API; сообщения сообщества требуют проверки.

Эти ограничения видны в разделе источников. Они не мешают работе карт, GPS и сохранённого справочника.

## Проверенные факты и пределы проверки

- Название сезона: **Kord Breach**, сезон 1. Официально объявлен конец 7 декабря 2026 года: https://t.me/escapefromtarkovEN/6985. Час/часовой пояс не указан, поэтому обратный отсчёт в днях и часах не запускается. Если в будущем подтверждён точный момент, модель и интерфейс поддерживают таймер. Архивирование даты без часа выполняется консервативно после завершения её календарного окна.
- Halloween: подтверждены событие и ветвление между торговцами, а также добавление фона к наградам за **Triumph of Science** и **Shields Up!**: https://t.me/escapefromtarkovEN/6962 и https://t.me/escapefromtarkovEN/6963. Текущая активность, срок окончания и отдельная гарантия бессрочного сохранения фона этим материалом не подтверждаются.
- Плакат **Tarkov of the Dead**: сведения сообщества; точное условие и сохранение после события не подтверждены первоисточником. Гарантированной наградой не называется.
- Twitch Drops 6–9 ноября — отдельная завершённая акция, а не срок игровых заданий: https://t.me/escapefromtarkovEN/6970.
- **UNDEADTARKOV**: найден в сообществе, активация на аккаунте не проверялась; режимы, состав и срок не гарантируются. Подтверждённых бессрочных или проверенных активацией кодов нет. Приложение не входит в игровой аккаунт и не активирует коды за пользователя.

Редактирование проверенных сущностей: `public/data/game-info.json`. Для гарантированной активности нужны источник, проверенный статус, явные `active`, `startsAt`, `confirmationExpiresAt`. Для точного таймера нужны `endsAt` с временем и `endTimeConfirmed`. Не ставьте эти поля на основе приблизительных дат или сообщения сообщества.

## English

Events and seasons are separate. Active event cards require fresh confirmed activity; expired confirmations hide the card without inventing an event deadline. Confirmed completions are archived. Date-only season announcements never create a fictional hourly countdown.

An hourly GitHub Actions collector reads developer-only Steam announcements, the public official Telegram feed and the verified Battlestate YouTube RSS. It publishes a small sanitised JSON to the dedicated `content-feed` branch, leaving application source history unchanged. The app retrieves it at startup/hourly, caches it privately and keeps prior data when offline. Short publication previews retain the original language; no unreviewed AI walkthroughs or third-party images are generated/downloaded. Existing local walkthroughs remain available.

Promo codes are separated by permanence/temporary/archive and confirmed mode eligibility. Detection is not redemption verification. No code is currently claimed as permanently valid or activation-tested.

EFT website returns 403; forum integration is unconfirmed. Twitch, TikTok and Reddit have no authorised API connection configured. YouTube metadata is available, but videos/livestreams are not transcribed. These limitations are visible in the application.

Kord Breach ends on 7 December 2026 according to the official announcement, with no exact time given. The Halloween background is officially included in the two named achievement rewards; permanent retention and poster conditions are not claimed as guaranteed. The separate November Twitch Drops promotion is archived.

Tests cover activity expiry/completion, date-only timers, code status/mode filtering, hostile sources, source parsing, cache failure/restart/junctions and map-colour persistence. Manual UI checks cover RU/EN, news, promo filters, rewards, map background/marker separation, comparison and saved settings. Real redemption and unavailable third-party APIs have not been tested.
