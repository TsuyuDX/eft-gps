# Работа с полной Git-версией / Complete Git checkout

## Запуск на другом компьютере

1. Скачайте всю ветку `main` или `codex/eft-gps-1.7-development` через **Code → Download ZIP** либо клонируйте репозиторий через Sublime Merge.
2. Если скачали ZIP, полностью распакуйте его в доступную для записи папку.
3. Запустите **Start EFT GPS.cmd**. Node.js, необходимые модули, база, карты, изображения и готовые EXE входят в репозиторий. `npm install`, Git LFS и подключение к источникам данных для запуска не нужны.
4. Если версии нужен WebView2, а он ещё не установлен, части официального офлайн-пакета Microsoft автоматически проверяются и объединяются, затем открывается его установщик. Завершите его установку; если Microsoft попросит перезагрузку, выполните её и запустите приложение снова.

Нужна Windows 10 версии 1903 или новее / Windows 11, x64, .NET Framework 4.7.2 или новее. Это переносимая папка приложения; Windows и .NET не входят в комплект. Оставьте минимум 8 ГБ свободного места для клонирования и рабочей копии. На компьютере без Git используйте Download ZIP.

Полная проверка распакованного комплекта (необязательна):

```bat
runtime\node.exe scripts\prepare-portable.mjs --verify-package
```

## Откат и разработка

Теги `app-v1.0.0`, `app-v1.1.0`, `app-v1.4.0`, `app-v1.5.0`, `app-v1.6.0`, `app-v1.7.0`, `v1.7.1` отмечают полные сохранённые версии. Версий 1.2 и 1.3 среди архивов нет. Между тегами есть промежуточные коммиты загрузки файлов; для запуска выбирайте тег завершённой версии.

В Sublime Merge: **Tags → нужная версия → Checkout**. Для изменений на основе старой версии создайте от её тега новую ветку с префиксом `codex/`. Для возврата к текущей разработке выберите ветку **codex/eft-gps-1.7-development**. Перед переключением сохраните изменения через Commit или Stash.

Личные сохранения `userdata` не версионируются. Перед проверкой старой версии экспортируйте прогресс. Для независимого тестирования старой версии лучше распаковать её в другую папку: старые версии могут не поддерживать новые настройки и данные прогресса.

История восстановлена из архивов. Даты коммитов показывают время восстановления. К старым снимкам добавлены общие средства запуска, проверка комплекта и текущий офлайн-пакет WebView2; сам архивный код приложения и его база сохраняются из соответствующей сборки.

## Размеры и отправка

В Git нет личных сохранений, токенов, временных логов и больших ZIP/Setup-пакетов. Большой офлайн-установщик WebView2 представлен проверяемыми частями меньше 100 МиБ; готовый EXE восстанавливается локально при необходимости.

История разбита на коммиты с ограниченным объёмом новых данных. Первый Push всей ветки сразу может превысить лимит GitHub в 2 ГиБ: для первой публикации нужно отправлять подготовленные коммиты последовательно. После первой публикации обычные Fetch/Pull/Push передают изменения.

`main` содержит полный последний комплект. Рабочая ветка — `codex/eft-gps-1.7-development`. Старые теги и новые коммиты хранятся в одном репозитории.

## English

Clone the whole repository or extract the complete Download ZIP, then run **Start EFT GPS.cmd**. The checkout includes the offline database, maps, images, Node.js, production modules and compiled launchers. No npm install or Git LFS is needed. If WebView2 is missing, its bundled, checksum-verified Microsoft offline installer is reconstructed and opened. Complete the Microsoft installation and restart Windows if requested.

Use complete version tags for rollback, and create a branch before editing an old version. Back up progress before switching versions; testing an older release in a separate folder is recommended. Requires Windows 10 1903+ / Windows 11 x64 and .NET Framework 4.7.2+. The operating system and .NET are not bundled.

Старые удалённые теги v1.5.0–v1.7.0 относятся к документации и сохранены без изменений. Для запуска соответствующих версий выбирайте app-v*; первоначальные исходные коммиты сохранены в archive/original-source-history.
