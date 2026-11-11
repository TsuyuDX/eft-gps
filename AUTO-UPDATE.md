# Обновления EFT GPS / EFT GPS updates

При запуске локальной службы приложение один раз проверяет последний стабильный выпуск на GitHub. Личные данные и настройки не отправляются.

С версии **1.10.0** проверка получает только сведения о выпуске и манифест пакета. Уведомление показывает версию и список изменений. **«Обновить»** разрешает загрузку и запуск отдельного окна обновления; **«Позже»** скрывает предложение до следующего запуска. Без выбора пользователя файлы пакета не скачиваются и установщик не открывается. Старые уже установленные версии сохраняют прежнее поведение до перехода на новую.

С версии 1.8.0, если для установленной версии есть пакет изменений, скачиваются и проверяются только изменённые файлы. Остальная офлайн-база остаётся на месте. Если подходящего пакета нет, используется полный. Части скачиваются параллельно, максимум в три соединения; размеры и SHA-256 проверяются перед установкой.

Обновление устанавливается в текущую папку. Файлы проверяются во время распаковки, без повторного чтения каждого распакованного файла. На одном диске подготовленные файлы перемещаются, а не копируются ещё раз. Создаётся резервная копия заменяемых файлов; отмена или ошибка во время замены запускает откат. Пользовательские данные не входят в пакет.

Обычная установка: выберите родительскую папку в «Обзоре», внутри появится папка EFT GPS; затем «Далее → Установить». При выборе существующей установки используется её текущая папка. Во время операции показаны проценты, текущий файл, прошедшее время и примерный остаток. Журнал скрыт под «Подробнее». Отмена остаётся доступной; при откате нужно дождаться его завершения.

Версии 1.7.1–1.7.2 имеют старый механизм и для перехода на 1.8.0 автоматически загрузят полный пакет один раз. Можно вместо этого вручную установить 1.8.0 в текущую папку. Следующие выпуски используют небольшие пакеты, если в выпуске указан подходящий baseVersion. Версия 1.7.0 и старше требует ручной установки нового выпуска.

## Публикация / Publishing

В `.github/release-plan.json` для новой версии указываются фиксированный коммит и `deltaBases` — список поддерживаемых базовых версий. Workflow собирает полный установщик и отдельные ZIP с изменениями. Данные об этих пакетах добавляются в `deltas` манифеста `EFTGPS-update.json`. Все части загружаются до публикации Latest. Не изменяйте уже опубликованные assets или теги.

The application checks GitHub once per local-service launch. From **1.10.0**, checking retrieves release information and the package manifest only. The notification offers release notes, **Update** and **Later**. Only Update downloads the package and opens the separate update window; Later defers until the next launch. Older installed versions retain their earlier behaviour until upgraded. Version 1.8.0 supports exact-base incremental packages, with a full-package fallback. Downloads use up to three concurrent connections. Every part and the resulting archive are SHA-256 verified. Extraction verifies each file while writing it, and same-volume installation moves staged files instead of copying them again. Changed files are backed up; cancellation or failure rolls back replacements. Personal data stays untouched.

Setup uses Next → Install, creates an EFT GPS folder in the chosen parent, and displays percentages, the current file, elapsed time and an approximate remaining time only while installing. Technical logs are collapsed under Details. Version 1.7.1–1.7.2 needs one full upgrade to receive this mechanism.

## Права установки / Installation permissions

Текущий установщик работает без повышения прав в рекомендуемой папке программ пользователя. Для произвольной папки он может запросить права через стандартное окно Windows UAC. Загрузчик сохраняет пакет при отказе от UAC. Обычный процесс приложения запускается без повышения прав, а доступ к папке userdata получает исходный пользователь. Временная распаковка выполняется внутри выбранной папки после проверки записи. Рекомендуемая новая папка: `%LOCALAPPDATA%\Programs\EFT GPS`. При обновлении текущая папка сохраняется.

Current setup does not request elevation in the recommended user Programs folder. Custom destinations may require Windows UAC elevation. Cancelling the request keeps the downloaded package. The original unelevated process launches the application after setup; the original user receives Modify access to userdata only. Staging stays inside the selected folder after a write-access probe. The recommended new location is `%LOCALAPPDATA%\Programs\EFT GPS`; updates retain the existing location.
