# Обновления приложения / Application updates

Приложение один раз за запуск локальной службы запрашивает публичный последний стабильный выпуск `TsuyuDX/eft-gps` через GitHub Releases API. Повторное открытие страниц и интерфейса не запускает новую проверку. Токен GitHub не нужен. GPS, прогресс и другие личные данные не отправляются.

Если версия новее установленной, приложение автоматически загружает пакет. Внизу окна отображаются версия, имя загружаемой части, объём и проценты. Части и итоговый ZIP проверяются SHA-256. Старые версии и предварительные выпуски не устанавливаются. Ошибка сети или проверки не меняет установленные файлы; повторная проверка выполняется при следующем запуске службы.

После загрузки открывается отдельный режим **«Обновление приложения»**. Текущая папка определяется автоматически и заблокирована для изменения. Нажатие «Обновить приложение» и подтверждение закрывают окно именно этой установки и останавливают её локальную службу. Обновление проверяет версию, создаёт резервные копии изменённых файлов и заменяет их; при ошибке выполняется откат. `userdata` и личные настройки не входят в пакет. Автосъёмка GPS после перезапуска включается пользователем заново.

Обычный установщик первой установки продолжает предлагать выбор папки. Чтобы получить функцию автообновления из версии 1.7.0 или старше, сначала установите версию 1.7.1 вручную в существующую папку. Наличие ссылки или загрузка пакета сами по себе не подтверждают успешную установку.

## Публикация следующей версии

1. Измените версию приложения, интерфейса и native-компонентов, пересоберите EXE и полный ZIP обычным процессом выпуска.
2. `scripts/build-release.ps1` создаёт также каталог `Releases/<version>/AutoUpdate`. Если ZIP уже подготовлен, выполните:

   `runtime\node.exe scripts\build-app-update.mjs <полный ZIP> <новая пустая папка AutoUpdate> <версия>`

3. В черновик GitHub Release с тегом `v<версия>` загрузите **все** файлы из AutoUpdate: `EFTGPS-update.json` и `EFTGPS-update-<версия>.zip.partNN`. Это отдельные release assets, не файлы репозитория и не исходники GitHub Source code.zip. Каждая часть не больше 1 ГиБ. Манифест содержит версию, размеры и SHA-256 частей и всего ZIP.
4. Только после загрузки всех частей публикуйте стабильный выпуск и отмечайте его Latest. Не меняйте файлы уже опубликованного пакета. Пока публичный репозиторий недоступен, автозагрузка с GitHub недоступна, приложение работает офлайн.

## English

The local service checks the latest public stable GitHub release once per launch. Newer releases download automatically with a bottom progress indicator showing the version, current part, size and percentage. Every part and the assembled ZIP are SHA-256 verified. Failed or unavailable updates leave the current application unchanged.

The dedicated update window uses the existing application directory and preserves personal data. Confirming the update closes that installation, backs up changed files and replaces them, with rollback on failure. Install 1.7.1 manually once to enable automatic updates from future releases. Upload the generated update manifest and **all** parts as release assets before publishing a stable release as Latest. Public GitHub availability is required for updates, but not for the offline application.
