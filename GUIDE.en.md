# T_S_U_Y_U EFT GPS 1.7.0

Offline maps, screenshot GPS and raid preparation for Escape from Tarkov on Windows. Created by T_S_U_Y_U.

## Install

Download **[EFT-GPS-Setup.exe](https://github.com/TsuyuDX/eft-gps/releases/latest/download/EFT-GPS-Setup.exe)** and run it. Click **Download and install**. The helper downloads and verifies the full package, then opens setup automatically. Choose a folder and confirm installation. To update, select your existing app folder: progress, markers, notes and GPS settings are preserved.

Internet is required for the initial download. The installed app works offline. Advanced manual downloads are described in the repository README.

Requires Windows 10 version 1903 or later, or Windows 11, x64. The installer checks system components and free space. The full package includes the rendering runtime for offline setup if it is missing. No separate drivers are needed.

## First launch

Choose Russian or English in the app. Both interface and saved game content are available in these languages. The installer selects its default language from Windows; this does not override your app choice.

The startup screen checks the local database, writable saves, GPS helper and known game folders. It preserves existing working paths. Missing screenshot and log paths can be discovered in conventional locations and Steam libraries, without scanning the entire drive. Missing screenshots do not block the reference app. Startup never enables auto capture or deletes screenshots.

A brief introduction explains maps, quests, GPS and backups. Replay it under **Help**, alongside FAQs, release notes, credits and a bug-report template. The template contains app version, mode, language and database date; it excludes personal paths, notes and progress. Nothing is sent automatically.

## Before your raid

- Choose PvP or PvE; each mode has separate progress.
- Open a map, choose a floor, then enable the marker types and hazard zones you need.
- Search quests or items. Quest details include objectives, required keys and available saved illustrations. Quests without a detailed walkthrough use an objective-based plan.
- Check the screenshot folder in GPS settings. Enable auto capture manually before your raid; it only operates while the game window is active.

GPS shows the last position read from a game screenshot filename. It does not measure movement between screenshots. Check the detection age on the map. Auto capture must be enabled again after restarting the app. No game process memory is read.

Optional cleanup removes processed screenshots created during an auto-capture session, including screenshots taken manually during that session. Older files and screenshots outside that session are kept.

## Controls and saves

**Ctrl+K** opens global search. **Esc** closes details or collapses the map. Scroll to zoom; drag to pan. Settings let you hide interface and map elements. Map filters are remembered per map and game mode.

Personal data lives in **userdata**. Keep this folder. Export and import progress backups in Settings. To move all settings to another PC, close the app and copy userdata together with the app.

Maps, images and reference data are stored locally. Prices, events and spawn chances reflect the saved database; they are not live values. Some source illustrations may be unavailable. Updating data and opening external links require internet. English content updates with app releases; a separate Russian database refresh retains the English snapshot and its original date.

The installer verifies file hashes and backs up replaced files. If installation fails, inspect the installer log and userdata/maintenance-error.log.

## Community

[Repository and releases](https://github.com/TsuyuDX/eft-gps) · [Report an issue](https://github.com/TsuyuDX/eft-gps/issues)

**Discord — coming soon.** **Support the project — coming soon.** These are placeholders without active destination links.

Escape from Tarkov and game assets © Battlestate Games. An independent community application, not an official Battlestate Games product.

[Official game website](https://www.escapefromtarkov.com/) · [Official developer announcements](https://steamcommunity.com/app/3932890/announcements/) · [Русский](GUIDE.ru.md)

