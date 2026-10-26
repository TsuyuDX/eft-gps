# T_S_U_Y_U EFT GPS

**Offline maps, screenshot GPS and raid preparation for Escape from Tarkov.**

[Download the latest release](https://github.com/TsuyuDX/eft-gps/releases/latest) · [All versions](https://github.com/TsuyuDX/eft-gps/releases) · [Report a bug / suggest an idea](https://github.com/TsuyuDX/eft-gps/issues)

Created by **T_S_U_Y_U** · Windows 10/11 x64 · Русский / English · Current version **1.7.0**

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

Open **[Releases](https://github.com/TsuyuDX/eft-gps/releases/latest)** and download **both `.part` files**, **`setup-parts.json`** and **`Join-Setup.cmd`** into the same folder. Run `Join-Setup.cmd`; it verifies the downloaded parts and recreates the original installer EXE. Run the resulting EXE and choose your installation folder. `SHA256SUMS.txt` is available for manual verification.

To update, select your existing app folder. Progress, notes, map markers and GPS preferences are preserved. An optional desktop shortcut launches the app in its own window.

The download is split because the full offline package exceeds GitHub's per-file limit. The automatically generated **Source code ZIP/TAR** contains this release page and documentation; it is not the application installer.

Requires **Windows 10 version 1903 or newer / Windows 11, x64**. The installer checks the required system components. The full package includes the rendering runtime for offline installation if missing. No separate drivers are required.

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

Скачайте обе части `.part`, `setup-parts.json` и `Join-Setup.cmd` из последнего выпуска в одну папку. Запустите `Join-Setup.cmd`, затем полученный EXE. При обновлении выберите папку уже установленной программы. Автоматический архив Source code содержит документацию, а не приложение.

Язык программы выбирается при первом запуске и меняется в настройках. Установщик берёт язык системы. В «Помощи» доступны обзор, FAQ и список изменений. Discord и поддержка проекта **скоро будут доступны**.

## Game and author

Created by **T_S_U_Y_U**. Escape from Tarkov and game assets © **Battlestate Games**. This is an independent community application, not an official Battlestate Games product.

[Official Escape from Tarkov website](https://www.escapefromtarkov.com/) · [Official developer announcements](https://steamcommunity.com/app/3932890/announcements/)
