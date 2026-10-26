# T_S_U_Y_U EFT GPS

**Offline maps, screenshot GPS and raid preparation for Escape from Tarkov.**

[![Скачать для Windows / Download for Windows](download.svg)](https://github.com/TsuyuDX/eft-gps/releases/latest/download/EFT-GPS-Setup.exe)

[All versions](https://github.com/TsuyuDX/eft-gps/releases) · [Report a bug / suggest an idea](https://github.com/TsuyuDX/eft-gps/issues)

Created by **T_S_U_Y_U** · Windows 10/11 x64 · Русский / English · Current version **1.7.0**

**Установка в три шага:**

1. Нажмите **«Скачать / Download»** — получите один файл `EFT-GPS-Setup.exe`.
2. Откройте его и нажмите **«Скачать и установить»**. Загрузчик сам подготовит нужный пакет.
3. Выберите папку в открывшемся установщике и нажмите **«Установить»**.

Для первого скачивания нужен интернет. После установки карты, справочник и GPS работают офлайн. При обновлении выберите текущую папку приложения, чтобы сохранить прогресс.

![Application overview](screenshots/overview.png)

## What it does

- Interactive offline maps with floor selection, sharp map drawings, marker categories and individual container filters.
- Quest markers open objectives, required keys and available saved walkthroughs with illustrations. Search covers names and instructions.
- Screenshot GPS places your last detected position on the map and shows its age. Optional auto capture operates only while the game is focused.
- Optional screenshot cleanup handles processed screenshots created during the auto-capture session. Older screenshots remain untouched.
- Offline item catalog, trader reference, bosses, events, hideout requirements and an item tracker.
- Separate PvP and PvE progress, personal map markers, notes and backup export/import.
- Black and sand interface, slim translucent scrollbars, a matching installer and folder picker.
- Russian and English interface, game data and saved guides. The installer defaults to the Windows language; the app asks for your preference.
- Startup checks for local content, writable saves, GPS components and known game folders. A first-run tour can be replayed under Help.

![Map and filters](screenshots/map.png)

## Download and install

1. **[Download EFT-GPS-Setup.exe](https://github.com/TsuyuDX/eft-gps/releases/latest/download/EFT-GPS-Setup.exe).** This is the only file you need.
2. Run it and click **Download and install**. It downloads the correct package, verifies it and opens setup automatically.
3. Choose your app folder and click **Install**. For updates, select the existing folder to preserve your progress.

The small downloader requires internet to retrieve the full offline package (about 2.38 GB for 1.7.0). Once installed, the app works offline. The installer language defaults to Windows; RU and EN buttons let you change it.

![Simple download and setup](screenshots/setup.png)

Requires **Windows 10 version 1903 or newer / Windows 11, x64**. The full package includes the rendering runtime if needed. No separate drivers are required.

<details>
<summary>Manual offline package · Ручная загрузка полного пакета</summary>

Advanced users can download both `.part` files, `setup-parts.json` and `Join-Setup.cmd` from the chosen release into one folder. Run `Join-Setup.cmd`, then the reconstructed setup EXE. Every part and the final file are checked with SHA-256. `SHA256SUMS.txt` is available for manual verification.

Для ручной загрузки скачайте обе части `.part`, `setup-parts.json` и `Join-Setup.cmd` в одну папку. Запустите `Join-Setup.cmd`, затем полученный EXE. Для обычной установки достаточно кнопки скачивания выше.

The automatically generated Source code archives contain repository documentation. Install using `EFT-GPS-Setup.exe` or the complete offline package.

</details>

## GPS: how it works

GPS reads coordinates from newly created **in-game screenshot filenames**. It shows the latest detected position, not continuous movement between captures. The app does not read game process memory and does not display other players, Scavs or bosses as live entities. Static reference markers are saved map data.

Check the screenshot folder under GPS. If automatic discovery cannot find it, create a game screenshot first and select its folder manually. Auto capture must be enabled manually for each app session. Always check the position age shown on the map.

With cleanup enabled, processed screenshots created during auto capture are removed, including manual screenshots taken during that session. Older files and screenshots outside the session are kept.

## Offline data and privacy

Maps, reference records and saved illustrations are bundled locally. Prices, events and spawn chances reflect the saved database rather than live values. Some source illustrations may be unavailable; quests without a full guide display a plan based on their actual objectives.

Personal settings and progress are stored in `userdata`. Keep that folder when moving the application. Backups can be exported from Settings. English content updates with app releases. A separate Russian database refresh preserves the English snapshot with its original date.

The bug-report template excludes personal paths, notes and progress. Reports are sent only when you submit them yourself.

![Help and tour replay](screenshots/help.png)

![First-run introduction](screenshots/tour.png)

## Help, controls and community

**Ctrl+K** — search · **Esc** — close details / collapse the map · **Mouse wheel** — zoom · **Drag** — pan.

Help includes the first-run tour, FAQs, release notes, credits and a bug-report template.

**Discord server — coming soon.** A placeholder is included in the app; there is no active invite yet.

**Support the project — coming soon.** There is no active donation link yet.

Read the [English guide](GUIDE.en.md) or [русское руководство](GUIDE.ru.md).

## Version archive

| Version | Branding | Main changes |
| --- | --- | --- |
| **1.7.0** | **T_S_U_Y_U EFT GPS** | English game data, first-run tour, Help and final branding for this release |
| 1.6.0 | Тарков GPS | Startup checks, language selection and translucent scrollbars |
| 1.5.0 | Тарков GPS | Updated black/sand interface, application news and matching installer |

Older installers are preserved as originally built. Their names and capabilities may differ from 1.7.0. This repository distributes releases and documentation.

## По-русски

**T_S_U_Y_U EFT GPS** — карты, GPS по игровым скриншотам, задания и подготовка к рейду в отдельном приложении для Windows. Сохранённые данные работают без интернета.

Нажмите кнопку скачивания в начале страницы и запустите **EFT-GPS-Setup.exe**. Нажмите **«Скачать и установить»**: нужные файлы будут загружены и проверены автоматически. Затем выберите папку и подтвердите установку. При обновлении укажите текущую папку программы.

Язык программы выбирается при первом запуске и меняется в настройках. Установщик берёт язык системы. В «Помощи» доступны обзор, FAQ и список изменений. Discord и поддержка проекта **скоро будут доступны**.

## Game and author

Created by **T_S_U_Y_U**. Escape from Tarkov and game assets © **Battlestate Games**. This is an independent community application, not an official Battlestate Games product.

[Official Escape from Tarkov website](https://www.escapefromtarkov.com/) · [Official developer announcements](https://steamcommunity.com/app/3932890/announcements/)
